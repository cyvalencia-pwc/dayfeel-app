package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dayfeel.identity.events.*;
import com.dayfeel.identity.privacy.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ContentEventHandlerTest {
  @Mock ProcessedEventRepository processed;
  @Mock PrivacyService privacy;
  final TestClock clock = new TestClock();
  ContentEventHandler handler;
  final UUID request = UUID.randomUUID(), user = UUID.randomUUID();

  @BeforeEach
  void setup() {
    handler = new ContentEventHandler(processed, privacy, clock);
  }

  DomainEvent event(String type, int version, Map<String, Object> payload) {
    return new DomainEvent(UUID.randomUUID(), type, version, clock.instant(), payload);
  }

  @Test
  void deletionCompleted() {
    var e = event("UserDeletionCompleted", 1, Map.of("requestId", request, "userId", user));
    when(processed.claim(e.id().toString(), clock.instant())).thenReturn(1);
    handler.handle(e);
    verify(privacy).complete(request, user, PrivacyRequest.Kind.DELETION, null);
  }

  @Test
  void exportCompleted() {
    var e =
        event(
            "DataExportCompleted",
            1,
            Map.of("requestId", request, "userId", user, "objectKey", "key"));
    when(processed.claim(e.id().toString(), clock.instant())).thenReturn(1);
    handler.handle(e);
    verify(privacy).complete(request, user, PrivacyRequest.Kind.EXPORT, "key");
  }

  @Test
  void duplicateNoOp() {
    handler.handle(event("UserDeletionCompleted", 1, Map.of("requestId", request, "userId", user)));
    verifyNoInteractions(privacy);
  }

  @Test
  void failurePropagatesForTransactionRollback() {
    var e = event("UserDeletionCompleted", 1, Map.of("requestId", request, "userId", user));
    when(processed.claim(e.id().toString(), clock.instant())).thenReturn(1);
    doThrow(new IllegalStateException())
        .when(privacy)
        .complete(request, user, PrivacyRequest.Kind.DELETION, null);
    assertThatThrownBy(() -> handler.handle(e)).isInstanceOf(IllegalStateException.class);
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 2, -1})
  void wrongVersionRejected(int version) {
    assertThatThrownBy(() -> handler.handle(event("UserDeletionCompleted", version, Map.of())))
        .isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(processed);
  }

  @ParameterizedTest
  @ValueSource(strings = {"Unknown", "JournalCreated", ""})
  void unknownTypeRejected(String type) {
    assertThatThrownBy(() -> handler.handle(event(type, 1, Map.of())))
        .isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(processed);
  }

  @Test
  void extraPrivateTextFieldRejected() {
    assertThatThrownBy(
            () ->
                handler.handle(
                    event(
                        "UserDeletionCompleted",
                        1,
                        Map.of("requestId", request, "userId", user, "text", "sensitive"))))
        .isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(processed);
  }

  @Test
  void missingUserRejected() {
    assertThatThrownBy(
            () -> handler.handle(event("UserDeletionCompleted", 1, Map.of("requestId", request))))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
