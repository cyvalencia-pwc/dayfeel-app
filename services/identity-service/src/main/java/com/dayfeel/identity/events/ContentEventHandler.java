package com.dayfeel.identity.events;

import com.dayfeel.identity.privacy.*;
import java.time.Clock;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContentEventHandler {
  private final ProcessedEventRepository processed;
  private final PrivacyService privacy;
  private final Clock clock;

  public ContentEventHandler(
      ProcessedEventRepository processed, PrivacyService privacy, Clock clock) {
    this.processed = processed;
    this.privacy = privacy;
    this.clock = clock;
  }

  @Transactional
  public void handle(DomainEvent event) {
    if (event.id() == null || event.occurredAt() == null || event.version() != 1)
      throw new IllegalArgumentException("Invalid event envelope");
    PrivacyRequest.Kind kind =
        switch (event.type()) {
          case "DataExportCompleted" -> PrivacyRequest.Kind.EXPORT;
          case "UserDeletionCompleted" -> PrivacyRequest.Kind.DELETION;
          default -> throw new IllegalArgumentException("Unsupported event");
        };
    Set<String> allowed =
        kind == PrivacyRequest.Kind.EXPORT
            ? Set.of("requestId", "userId", "objectKey")
            : Set.of("requestId", "userId");
    if (!allowed.equals(event.payload().keySet()))
      throw new IllegalArgumentException("Invalid event payload");
    UUID request = UUID.fromString(String.valueOf(event.payload().get("requestId")));
    UUID user = UUID.fromString(String.valueOf(event.payload().get("userId")));
    if (processed.claim(event.id().toString(), clock.instant()) == 0) return;
    privacy.complete(
        request,
        user,
        kind,
        kind == PrivacyRequest.Kind.EXPORT
            ? String.valueOf(event.payload().get("objectKey"))
            : null);
  }
}
