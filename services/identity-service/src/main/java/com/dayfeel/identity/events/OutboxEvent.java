package com.dayfeel.identity.events;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "outbox_events")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OutboxEvent {
  @Id
  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID id;

  private String type;
  private int version;
  private Instant occurredAt;

  @Column(columnDefinition = "TEXT")
  private String payload;

  private boolean published;

  public OutboxEvent(DomainEvent event, String payload) {
    id = event.id();
    type = event.type();
    version = event.version();
    occurredAt = event.occurredAt();
    this.payload = payload;
  }
}
