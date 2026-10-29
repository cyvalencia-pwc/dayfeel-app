package com.dayfeel.identity.community;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "moderation_actions")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ModerationAction {
  @Id
  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID id;

  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID actorId;

  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID targetId;

  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID circleId;

  private String contentId;
  private String action;
  private Instant createdAt;

  public ModerationAction(
      UUID actor, UUID target, UUID circle, String content, String action, Instant at) {
    id = UUID.randomUUID();
    actorId = actor;
    targetId = target;
    circleId = circle;
    contentId = content;
    this.action = action;
    createdAt = at;
  }
}
