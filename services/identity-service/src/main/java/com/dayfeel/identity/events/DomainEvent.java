package com.dayfeel.identity.events;

import java.time.Instant;
import java.util.*;

public record DomainEvent(
    UUID id, String type, int version, Instant occurredAt, Map<String, Object> payload) {
  public DomainEvent {
    payload = Map.copyOf(payload);
  }
}
