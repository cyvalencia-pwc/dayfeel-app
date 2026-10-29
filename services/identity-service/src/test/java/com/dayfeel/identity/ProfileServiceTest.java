package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.*;
import com.dayfeel.identity.events.*;
import com.dayfeel.identity.profile.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProfileServiceTest {
  @Mock UserRepository users;
  @Mock StorageService storage;
  @Mock EventPublisher events;
  @Mock AuditLog audit;
  final TestClock clock = new TestClock();
  User user;
  ProfileService service;

  @BeforeEach
  void setup() {
    user = new User(UUID.randomUUID(), "a@example.com", "hash", "QuietOtter", clock.instant());
    service = new ProfileService(users, storage, events, clock, audit);
  }

  @Test
  void sessionUsesServerRolesAndOnboardingIsExplicit() {
    when(users.findById(user.getId())).thenReturn(Optional.of(user));
    user.getRoles().add(new Role("ADMIN"));
    assertThat(service.session(user.getId()).roles()).containsExactlyInAnyOrder("USER", "ADMIN");
    assertThat(service.session(user.getId()).onboardingComplete()).isFalse();
    when(users.lockById(user.getId())).thenReturn(Optional.of(user));
    service.completeOnboarding(user.getId());
    assertThat(service.session(user.getId()).onboardingComplete()).isTrue();
  }

  @Test
  void flagsDefaultOff() {
    assertThat(service.consentOf(user)).isEqualTo(new ProfileService.Consent(false));
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void persistsEachConsentCombination(boolean memory) {
    when(users.lockById(user.getId())).thenReturn(Optional.of(user));
    var c = new ProfileService.Consent(memory);
    assertThat(service.consent(user.getId(), c)).isEqualTo(c);
    assertThat(service.consentOf(user)).isEqualTo(c);
    verify(events)
        .publish(
            argThat(
                e ->
                    e.type().equals("ConsentChanged")
                        && e.payload().get("companionMemory").equals(memory)));
  }

  @ParameterizedTest
  @ValueSource(strings = {"ab", "a b", "1Otter", "<script>", "x@y.com"})
  void invalidAliasRejected(String alias) {
    assertThatThrownBy(() -> service.alias(user.getId(), alias))
        .isInstanceOf(DomainException.class);
    verifyNoInteractions(users);
  }

  @Test
  void aliasUpdated() {
    when(users.lockById(user.getId())).thenReturn(Optional.of(user));
    assertThat(service.alias(user.getId(), "CalmFox42").alias()).isEqualTo("CalmFox42");
    verify(events)
        .publish(
            argThat(
                e ->
                    e.type().equals("AliasChanged")
                        && e.payload().get("alias").equals("CalmFox42")
                        && e.payload().get("userId").toString().equals(user.getId().toString())));
  }

  @Test
  void duplicateAliasRejected() {
    when(users.lockById(user.getId())).thenReturn(Optional.of(user));
    when(users.existsByAlias("CalmFox42")).thenReturn(true);
    assertThatThrownBy(() -> service.alias(user.getId(), "CalmFox42"))
        .isInstanceOf(DomainException.class);
  }

  @Test
  void ownAliasUnchangedAllowed() {
    when(users.lockById(user.getId())).thenReturn(Optional.of(user));
    service.alias(user.getId(), "QuietOtter");
    verify(users, never()).existsByAlias(any());
  }

  @ParameterizedTest
  @ValueSource(strings = {"text/html", "image/svg+xml", "application/json"})
  void invalidImageRejected(String type) {
    assertThatThrownBy(() -> service.avatar(user.getId(), type, 10))
        .isInstanceOf(DomainException.class);
    verifyNoInteractions(storage);
  }

  @ParameterizedTest
  @ValueSource(longs = {0, -1, 5242881})
  void invalidSizeRejected(long size) {
    assertThatThrownBy(() -> service.avatar(user.getId(), "image/png", size))
        .isInstanceOf(DomainException.class);
  }

  @ParameterizedTest
  @ValueSource(strings = {"image/png", "image/jpeg", "image/webp"})
  void uploadKeyBelongsToUser(String type) {
    when(users.lockById(user.getId())).thenReturn(Optional.of(user));
    when(storage.avatarUpload(anyString(), eq(type), eq(10L)))
        .thenAnswer(i -> new StorageService.Upload(i.getArgument(0), "url", clock.instant(), true));
    var result = service.avatar(user.getId(), type, 10);
    assertThat(result.objectKey()).startsWith("avatars/" + user.getId() + "/");
    assertThat(user.getAvatarKey()).isEqualTo(result.objectKey());
  }

  @Test
  void stubDoesNotClaimUploadWorks() {
    var stub = new LocalStorageService(clock);
    assertThat(stub.avatarUpload("key", "image/png", 10).uploadSupported()).isFalse();
    assertThat(stub.download("key")).isEmpty();
  }

  @Test
  void missingProfileIs404() {
    assertThatThrownBy(() -> service.get(UUID.randomUUID())).isInstanceOf(DomainException.class);
  }

  @Test
  void profileDoesNotExposeIdentity() {
    when(users.findById(user.getId())).thenReturn(Optional.of(user));
    assertThat(service.get(user.getId()).toString())
        .doesNotContain(user.getEmail(), user.getId().toString(), "hash");
  }
}
