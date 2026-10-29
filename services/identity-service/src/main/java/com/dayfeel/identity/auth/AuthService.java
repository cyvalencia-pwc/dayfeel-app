package com.dayfeel.identity.auth;

import com.dayfeel.identity.common.*;
import com.dayfeel.identity.config.DayfeelProperties;
import java.time.*;
import java.util.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private final UserRepository users;
  private final RoleRepository roles;
  private final RefreshTokenRepository tokens;
  private final PasswordEncoder passwords;
  private final TokenSecrets secrets;
  private final JwtService jwt;
  private final Clock clock;
  private final DayfeelProperties properties;
  private final AuditLog audit;
  private final String dummyHash;

  public AuthService(
      UserRepository users,
      RoleRepository roles,
      RefreshTokenRepository tokens,
      PasswordEncoder passwords,
      TokenSecrets secrets,
      JwtService jwt,
      Clock clock,
      DayfeelProperties properties,
      AuditLog audit) {
    this.users = users;
    this.roles = roles;
    this.tokens = tokens;
    this.passwords = passwords;
    this.secrets = secrets;
    this.jwt = jwt;
    this.clock = clock;
    this.properties = properties;
    this.audit = audit;
    this.dummyHash = passwords.encode(UUID.randomUUID().toString());
  }

  public record Tokens(String accessToken, String refreshToken, String tokenType, long expiresIn) {}

  @Transactional
  public Tokens register(String email, String password) {
    if (password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
      throw new DomainException(
          400, "PASSWORD_TOO_LONG", "Password must be at most 72 UTF-8 bytes");
    email = normalize(email);
    if (users.existsByEmail(email))
      throw new DomainException(409, "ACCOUNT_EXISTS", "Account cannot be registered");
    UUID id = UUID.randomUUID();
    var user =
        new User(
            id,
            email,
            passwords.encode(password),
            "QuietOtter" + id.toString().replace("-", "").substring(0, 24),
            clock.instant());
    user.getRoles().add(roles.findById("USER").orElseThrow());
    users.saveAndFlush(user);
    audit.record(AuditLog.Action.REGISTER, id);
    return issue(user);
  }

  // Authentication failures intentionally commit lockout counters and token revocation.
  @Transactional(noRollbackFor = DomainException.class)
  public Tokens login(String email, String password) {
    var found = users.lockByEmail(normalize(email));
    if (found.isEmpty()) {
      passwords.matches(password, dummyHash);
      throw DomainException.unauthorized();
    }
    var u = found.get();
    active(u);
    if (u.getLockedUntil() != null && u.getLockedUntil().isAfter(clock.instant()))
      throw new DomainException(429, "ACCOUNT_LOCKED", "Please try again later");
    if (u.getLockedUntil() != null) {
      u.setFailedLogins(0);
      u.setLockedUntil(null);
    }
    if (!passwords.matches(password, u.getPasswordHash())) {
      u.setFailedLogins(u.getFailedLogins() + 1);
      if (u.getFailedLogins() >= 5) u.setLockedUntil(clock.instant().plus(Duration.ofMinutes(15)));
      audit.record(AuditLog.Action.LOGIN_FAILED, u.getId());
      throw DomainException.unauthorized();
    }
    u.setFailedLogins(0);
    u.setLockedUntil(null);
    audit.record(AuditLog.Action.LOGIN, u.getId());
    return issue(u);
  }

  @Transactional(noRollbackFor = DomainException.class)
  public Tokens refresh(String raw) {
    String hash = secrets.hash(raw);
    var owner = tokens.ownerOf(hash).orElseThrow(DomainException::unauthorized);
    var u = users.lockById(owner).orElseThrow(DomainException::unauthorized);
    active(u);
    // Clear stale token state by locking/reloading via a refresh query after user serialization.
    var t = tokens.findById(hash).orElseThrow(DomainException::unauthorized);
    if (t.isConsumed() || t.isRevoked()) {
      revoke(u);
      audit.record(AuditLog.Action.REFRESH_REUSE, u.getId());
      throw DomainException.unauthorized();
    }
    if (!t.getExpiresAt().isAfter(clock.instant())) throw DomainException.unauthorized();
    t.setConsumed(true);
    return issue(u);
  }

  @Transactional
  public void logout(UUID id) {
    var u = users.lockById(id).orElseThrow(DomainException::unauthorized);
    revoke(u);
    audit.record(AuditLog.Action.LOGOUT, id);
  }

  public void revoke(User u) {
    tokens.revokeAll(u.getId());
    u.setTokenVersion(u.getTokenVersion() + 1);
  }

  private Tokens issue(User u) {
    String raw = secrets.create();
    tokens.save(
        new RefreshToken(
            secrets.hash(raw), u.getId(), clock.instant().plus(properties.jwt().refreshTtl())));
    return new Tokens(jwt.issue(u), raw, "Bearer", properties.jwt().accessTtl().toSeconds());
  }

  private void active(User u) {
    if (u.getStatus() != User.Status.ACTIVE) throw DomainException.unauthorized();
  }

  private String normalize(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
