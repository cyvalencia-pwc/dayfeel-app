package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.*;
import com.dayfeel.identity.events.*;
import com.dayfeel.identity.privacy.*;
import com.dayfeel.identity.profile.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PrivacyServiceTest {
  @Mock UserRepository users;
  @Mock AuthService auth;
  @Mock PrivacyRequestRepository requests;
  @Mock EventPublisher events;
  @Mock StorageService storage;
  @Mock AuditLog audit;
  final TestClock clock = new TestClock();
  PrivacyService service;
  User user;

  @BeforeEach
  void setup() {
    service = new PrivacyService(users, auth, requests, events, storage, clock, audit);
    user = new User(UUID.randomUUID(), "a@example.com", "hash", "alias", clock.instant());
  }

  void requestSetup() {
    when(users.lockById(user.getId())).thenReturn(Optional.of(user));
    when(requests.save(any())).thenAnswer(i -> i.getArgument(0));
  }

  @Test
  void deletionRevokesBeforePublishing() {
    requestSetup();
    service.request(user.getId(), PrivacyRequest.Kind.DELETION);
    assertThat(user.getStatus()).isEqualTo(User.Status.PENDING_DELETION);
    var order = inOrder(auth, events);
    order.verify(auth).revoke(user);
    order.verify(events).publish(argThat(e -> e.type().equals("UserDeletionRequested")));
    verify(users, never()).delete(any());
  }

  @Test
  void exportKeepsAccountActive() {
    requestSetup();
    service.request(user.getId(), PrivacyRequest.Kind.EXPORT);
    assertThat(user.getStatus()).isEqualTo(User.Status.ACTIVE);
    verifyNoInteractions(auth);
  }

  @Test
  void duplicatePendingExportReused() {
    when(users.lockById(user.getId())).thenReturn(Optional.of(user));
    var r = new PrivacyRequest(user.getId(), PrivacyRequest.Kind.EXPORT, clock.instant());
    when(requests.findFirstByUserIdAndKindAndStatusOrderByCreatedAtDesc(
            user.getId(), PrivacyRequest.Kind.EXPORT, PrivacyRequest.Status.PENDING))
        .thenReturn(Optional.of(r));
    assertThat(service.request(user.getId(), PrivacyRequest.Kind.EXPORT).id()).isEqualTo(r.getId());
    verifyNoInteractions(events);
  }

  @Test
  void ownerOnlyStatus() {
    var r = new PrivacyRequest(UUID.randomUUID(), PrivacyRequest.Kind.EXPORT, clock.instant());
    when(requests.findById(r.getId())).thenReturn(Optional.of(r));
    assertThatThrownBy(() -> service.status(user.getId(), r.getId()))
        .isInstanceOf(DomainException.class);
    verifyNoInteractions(storage);
  }

  PrivacyRequest completionSetup(PrivacyRequest.Kind kind) {
    var r = new PrivacyRequest(user.getId(), kind, clock.instant());
    when(users.lockById(user.getId())).thenReturn(Optional.of(user));
    when(requests.lockById(r.getId())).thenReturn(Optional.of(r));
    return r;
  }

  @Test
  void deletionCompletesOnlyPendingAccount() {
    var r = completionSetup(PrivacyRequest.Kind.DELETION);
    assertThatThrownBy(() -> service.complete(r.getId(), user.getId(), r.getKind(), null))
        .isInstanceOf(DomainException.class);
    verify(users, never()).delete(any());
  }

  @Test
  void confirmedDeletionHardDeletes() {
    var r = completionSetup(PrivacyRequest.Kind.DELETION);
    user.setStatus(User.Status.PENDING_DELETION);
    service.complete(r.getId(), user.getId(), r.getKind(), null);
    verify(users).delete(user);
    assertThat(r.getUserId()).isNull();
    assertThat(r.getStatus()).isEqualTo(PrivacyRequest.Status.COMPLETED);
  }

  @Test
  void repeatedCompletionNoOp() {
    var r = completionSetup(PrivacyRequest.Kind.EXPORT);
    r.setStatus(PrivacyRequest.Status.COMPLETED);
    service.complete(r.getId(), user.getId(), r.getKind(), null);
    verify(users, never()).delete(any());
  }

  @Test
  void wrongKindRejected() {
    var r = completionSetup(PrivacyRequest.Kind.EXPORT);
    assertThatThrownBy(
            () -> service.complete(r.getId(), user.getId(), PrivacyRequest.Kind.DELETION, null))
        .isInstanceOf(DomainException.class);
  }

  @Test
  void wrongUserRejected() {
    var r = completionSetup(PrivacyRequest.Kind.EXPORT);
    r.setUserId(UUID.randomUUID());
    assertThatThrownBy(() -> service.complete(r.getId(), user.getId(), r.getKind(), null))
        .isInstanceOf(DomainException.class);
  }

  @Test
  void validExportKeySaved() {
    var r = completionSetup(PrivacyRequest.Kind.EXPORT);
    String key = "exports/" + r.getId() + "/data.zip";
    service.complete(r.getId(), user.getId(), r.getKind(), key);
    assertThat(r.getObjectKey()).isEqualTo(key);
  }

  @Test
  void jsonExportKeySaved() {
    var r = completionSetup(PrivacyRequest.Kind.EXPORT);
    String key = "exports/" + r.getId() + "/data.json";
    service.complete(r.getId(), user.getId(), r.getKind(), key);
    assertThat(r.getObjectKey()).isEqualTo(key);
  }

  @Test
  void foreignExportKeyRejected() {
    var r = completionSetup(PrivacyRequest.Kind.EXPORT);
    assertThatThrownBy(
            () -> service.complete(r.getId(), user.getId(), r.getKind(), "exports/other/data.zip"))
        .isInstanceOf(DomainException.class);
  }

  @Test
  void pendingDeletionCannotExport() {
    when(users.lockById(user.getId())).thenReturn(Optional.of(user));
    user.setStatus(User.Status.PENDING_DELETION);
    assertThatThrownBy(() -> service.request(user.getId(), PrivacyRequest.Kind.EXPORT))
        .isInstanceOf(DomainException.class);
  }
}
