package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.*;
import org.springframework.security.core.context.SecurityContextHolder;

@ExtendWith(MockitoExtension.class)
class JwtFilterTest {
  @Mock JwtService jwt;
  @Mock UserRepository users;
  final TestClock clock = new TestClock();
  JwtFilter filter;

  @BeforeEach
  void setup() {
    filter =
        new JwtFilter(
            jwt, users, new ErrorWriter(clock, new ObjectMapper().findAndRegisterModules()));
  }

  @AfterEach
  void cleanup() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void anonymousContinuesForSecurityChain() throws Exception {
    var called = new AtomicBoolean();
    filter.doFilter(
        new MockHttpServletRequest(), new MockHttpServletResponse(), (a, b) -> called.set(true));
    assertThat(called).isTrue();
  }

  @ParameterizedTest
  @ValueSource(strings = {"Basic secret", "bearer token", "", "Bearer"})
  void malformedHeaderRejected(String value) throws Exception {
    var r = new MockHttpServletRequest();
    r.addHeader("Authorization", value);
    var s = new MockHttpServletResponse();
    filter.doFilter(r, s, (a, b) -> fail("must not continue"));
    assertThat(s.getStatus()).isEqualTo(401);
  }

  User valid() {
    var u = new User(UUID.randomUUID(), "a@example.com", "hash", "alias", clock.instant());
    var c = Jwts.claims().subject(u.getId().toString()).add("ver", 0L).build();
    when(jwt.verify("token")).thenReturn(c);
    when(users.findById(u.getId())).thenReturn(Optional.of(u));
    return u;
  }

  MockHttpServletRequest request() {
    var r = new MockHttpServletRequest();
    r.addHeader("Authorization", "Bearer token");
    return r;
  }

  @Test
  void activeUserAuthenticated() throws Exception {
    var u = valid();
    u.getRoles().add(new Role("ADMIN"));
    filter.doFilter(request(), new MockHttpServletResponse(), (a, b) -> {});
    assertThat(SecurityContextHolder.getContext().getAuthentication().getName())
        .isEqualTo(u.getId().toString());
    assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
        .extracting("authority")
        .contains("ROLE_ADMIN");
  }

  @Test
  void staleVersionRejected() throws Exception {
    valid().setTokenVersion(1);
    var s = new MockHttpServletResponse();
    filter.doFilter(request(), s, (a, b) -> fail("must not continue"));
    assertThat(s.getStatus()).isEqualTo(401);
  }

  @Test
  void pendingDeletionRejected() throws Exception {
    valid().setStatus(User.Status.PENDING_DELETION);
    var s = new MockHttpServletResponse();
    filter.doFilter(request(), s, (a, b) -> fail("must not continue"));
    assertThat(s.getStatus()).isEqualTo(401);
  }

  @Test
  void invalidSignatureRejected() throws Exception {
    when(jwt.verify("token")).thenThrow(new JwtException("secret"));
    var s = new MockHttpServletResponse();
    filter.doFilter(request(), s, (a, b) -> fail("must not continue"));
    assertThat(s.getContentAsString()).doesNotContain("secret");
    assertThat(s.getStatus()).isEqualTo(401);
  }

  @Test
  void infrastructureErrorsAreSanitized() throws Exception {
    when(jwt.verify("token")).thenThrow(new IllegalStateException("database secret"));
    var response = new MockHttpServletResponse();
    filter.doFilter(request(), response, (a, b) -> fail("must not continue"));
    assertThat(response.getStatus()).isEqualTo(500);
    assertThat(response.getContentAsString()).doesNotContain("database secret");
  }
}
