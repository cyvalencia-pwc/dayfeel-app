package com.dayfeel.identity.community;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "memberships")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Membership {
  @Id
  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID id;

  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID circleId;

  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID userId;

  @Enumerated(EnumType.STRING)
  private MemberRole role;

  private boolean active = true;
  private Instant mutedUntil;
  private Instant bannedUntil;

  public enum MemberRole {
    OWNER,
    MODERATOR,
    MEMBER
  }

  public boolean restricted(Instant now) {
    return (mutedUntil != null && mutedUntil.isAfter(now))
        || (bannedUntil != null && bannedUntil.isAfter(now));
  }

  public Membership(UUID circleId, UUID userId, MemberRole role) {
    this.id = UUID.randomUUID();
    this.circleId = circleId;
    this.userId = userId;
    this.role = role;
  }
}
