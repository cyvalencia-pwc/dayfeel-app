package com.dayfeel.identity.events;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "processed_events")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProcessedEvent {
  @Id
  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID id;

  private Instant processedAt;
}
