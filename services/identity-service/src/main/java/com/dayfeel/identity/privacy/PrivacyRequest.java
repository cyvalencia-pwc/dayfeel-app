package com.dayfeel.identity.privacy;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "privacy_requests")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PrivacyRequest {
  @Id
  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID id;

  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID userId;

  @Enumerated(EnumType.STRING)
  private Kind kind;

  @Enumerated(EnumType.STRING)
  private Status status = Status.PENDING;

  private String objectKey;
  private Instant createdAt;

  public enum Kind {
    EXPORT,
    DELETION
  }

  public enum Status {
    PENDING,
    COMPLETED
  }

  public PrivacyRequest(UUID user, Kind kind, Instant at) {
    id = UUID.randomUUID();
    userId = user;
    this.kind = kind;
    createdAt = at;
  }
}
