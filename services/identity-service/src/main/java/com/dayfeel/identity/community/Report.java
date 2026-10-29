package com.dayfeel.identity.community;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "reports")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Report {
  @Id
  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID id;

  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID reporterId;

  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID targetId;

  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID circleId;

  private String contentId;

  @Enumerated(EnumType.STRING)
  private Reason reason;

  private Instant createdAt;

  public enum Reason {
    HARASSMENT,
    SPAM,
    UNSAFE,
    OTHER
  }

  public Report(
      UUID reporter, UUID target, UUID circle, String content, Reason reason, Instant at) {
    id = UUID.randomUUID();
    reporterId = reporter;
    targetId = target;
    circleId = circle;
    contentId = content;
    this.reason = reason;
    createdAt = at;
  }
}
