package com.dayfeel.identity.auth;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;
import lombok.*;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {
  @Id
  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID id;

  private String email;
  private String passwordHash;
  private String alias;

  @Enumerated(EnumType.STRING)
  private Status status = Status.ACTIVE;

  private String avatarKey;
  private int failedLogins;
  private Instant lockedUntil;
  private long tokenVersion;
  private Instant createdAt;
  private boolean companionMemory;
  private boolean onboardingComplete;

  @ManyToMany(fetch = FetchType.EAGER)
  @JoinTable(
      name = "user_roles",
      joinColumns = @JoinColumn(name = "user_id"),
      inverseJoinColumns = @JoinColumn(name = "role_name"))
  private Set<Role> roles = new HashSet<>();

  public enum Status {
    ACTIVE,
    PENDING_DELETION
  }

  public User(UUID id, String email, String passwordHash, String alias, Instant createdAt) {
    this.id = id;
    this.email = email;
    this.passwordHash = passwordHash;
    this.alias = alias;
    this.createdAt = createdAt;
  }

  public boolean hasRole(String role) {
    return roles.stream().anyMatch(r -> r.getName().equals(role));
  }
}
