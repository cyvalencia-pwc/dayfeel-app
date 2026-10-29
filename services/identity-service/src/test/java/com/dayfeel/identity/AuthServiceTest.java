package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
  @Mock UserRepository users;
  @Mock RoleRepository roles;
  @Mock RefreshTokenRepository tokens;
  @Mock PasswordEncoder passwords;
  @Mock JwtService jwt;
  @Mock AuditLog audit;
  final TestClock clock = new TestClock();
  final TokenSecrets secrets = new TokenSecrets();
  AuthService service;
  User user;

  @BeforeEach
  void setup() {
    when(passwords.encode(anyString())).thenReturn("encoded");
    service =
        new AuthService(
            users, roles, tokens, passwords, secrets, jwt, clock, TestProperties.create(), audit);
    user = new User(UUID.randomUUID(), "a@example.com", "encoded", "QuietOtter", clock.instant());
  }

  void loginSetup(boolean matches) {
    when(users.lockByEmail("a@example.com")).thenReturn(Optional.of(user));
    when(passwords.matches("password", "encoded")).thenReturn(matches);
  }

  @Test
  void registersHashedTokenAndNormalizedEmail() {
    when(roles.findById("USER")).thenReturn(Optional.of(new Role("USER")));
    when(jwt.issue(any())).thenReturn("jwt");
    var result = service.register(" A@example.com ", "password");
    var captor = ArgumentCaptor.forClass(RefreshToken.class);
    verify(tokens).save(captor.capture());
    assertThat(captor.getValue().getHash())
        .isEqualTo(secrets.hash(result.refreshToken()))
        .doesNotContain(result.refreshToken());
    verify(users).existsByEmail("a@example.com");
    assertThat(result.tokenType()).isEqualTo("Bearer");
  }

  @Test
  void duplicateRejected() {
    when(users.existsByEmail("a@example.com")).thenReturn(true);
    assertThatThrownBy(() -> service.register("a@example.com", "password"))
        .isInstanceOf(DomainException.class);
    verifyNoInteractions(tokens);
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 1, 2, 3})
  void failureIncrementsWithoutLock(int previous) {
    user.setFailedLogins(previous);
    loginSetup(false);
    assertThatThrownBy(() -> service.login("a@example.com", "password"))
        .isInstanceOf(DomainException.class);
    assertThat(user.getFailedLogins()).isEqualTo(previous + 1);
    assertThat(user.getLockedUntil()).isNull();
  }

  @Test
  void fifthFailureLocksFor15Minutes() {
    user.setFailedLogins(4);
    loginSetup(false);
    assertThatThrownBy(() -> service.login("a@example.com", "password"))
        .isInstanceOf(DomainException.class);
    assertThat(user.getLockedUntil()).isEqualTo(clock.instant().plusSeconds(900));
  }

  @Test
  void lockedAccountDoesNotCheckPassword() {
    when(users.lockByEmail("a@example.com")).thenReturn(Optional.of(user));
    user.setLockedUntil(clock.instant().plusSeconds(1));
    assertThatThrownBy(() -> service.login("a@example.com", "password"))
        .isInstanceOf(DomainException.class);
    verify(passwords, never()).matches(any(), any());
  }

  @ParameterizedTest
  @ValueSource(longs = {900, 901, 1000})
  void lockExpiresAtBoundary(long seconds) {
    user.setFailedLogins(5);
    user.setLockedUntil(clock.instant().plusSeconds(900));
    clock.advance(Duration.ofSeconds(seconds));
    loginSetup(true);
    when(jwt.issue(user)).thenReturn("jwt");
    service.login("a@example.com", "password");
    assertThat(user.getFailedLogins()).isZero();
    assertThat(user.getLockedUntil()).isNull();
  }

  @Test
  void successfulLoginResetsFailures() {
    user.setFailedLogins(3);
    loginSetup(true);
    when(jwt.issue(user)).thenReturn("jwt");
    service.login("a@example.com", "password");
    assertThat(user.getFailedLogins()).isZero();
  }

  @Test
  void unknownUserUsesDummyHash() {
    assertThatThrownBy(() -> service.login("missing@example.com", "password"))
        .isInstanceOf(DomainException.class);
    verify(passwords).matches("password", "encoded");
  }

  @Test
  void pendingUserCannotLogin() {
    user.setStatus(User.Status.PENDING_DELETION);
    when(users.lockByEmail("a@example.com")).thenReturn(Optional.of(user));
    assertThatThrownBy(() -> service.login("a@example.com", "password"))
        .isInstanceOf(DomainException.class);
    verifyNoInteractions(tokens);
  }

  RefreshToken refreshSetup() {
    var t = new RefreshToken(secrets.hash("raw"), user.getId(), clock.instant().plusSeconds(60));
    when(tokens.ownerOf(t.getHash())).thenReturn(Optional.of(user.getId()));
    when(users.lockById(user.getId())).thenReturn(Optional.of(user));
    when(tokens.findById(t.getHash())).thenReturn(Optional.of(t));
    return t;
  }

  @Test
  void refreshRotates() {
    var t = refreshSetup();
    when(jwt.issue(user)).thenReturn("jwt");
    var result = service.refresh("raw");
    assertThat(t.isConsumed()).isTrue();
    assertThat(result.refreshToken()).isNotEqualTo("raw");
    verify(tokens).save(any());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void reuseRevokesAll(boolean consumed) {
    var t = refreshSetup();
    t.setConsumed(consumed);
    t.setRevoked(!consumed);
    assertThatThrownBy(() -> service.refresh("raw")).isInstanceOf(DomainException.class);
    verify(tokens).revokeAll(user.getId());
    assertThat(user.getTokenVersion()).isEqualTo(1);
    verify(jwt, never()).issue(any());
  }

  @ParameterizedTest
  @ValueSource(longs = {60, 61, 120})
  void expiredRefreshRejected(long seconds) {
    refreshSetup();
    clock.advance(Duration.ofSeconds(seconds));
    assertThatThrownBy(() -> service.refresh("raw")).isInstanceOf(DomainException.class);
    verify(tokens, never()).save(any());
  }

  @Test
  void unknownRefreshRejected() {
    assertThatThrownBy(() -> service.refresh("raw")).isInstanceOf(DomainException.class);
  }

  @Test
  void logoutRevokesAccessAndRefresh() {
    when(users.lockById(user.getId())).thenReturn(Optional.of(user));
    service.logout(user.getId());
    verify(tokens).revokeAll(user.getId());
    assertThat(user.getTokenVersion()).isEqualTo(1);
  }
}
