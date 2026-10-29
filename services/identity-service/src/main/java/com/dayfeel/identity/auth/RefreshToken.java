package com.dayfeel.identity.auth;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken {
  @Id private String hash;

  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID userId;

  private Instant expiresAt;
  private boolean revoked;
  private boolean consumed;

  public RefreshToken(String hash, UUID userId, Instant expiresAt) {
    this.hash = hash;
    this.userId = userId;
    this.expiresAt = expiresAt;
  }
}
