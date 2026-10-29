package com.dayfeel.identity.profile;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.*;
import com.dayfeel.identity.events.*;
import java.time.Clock;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {
  private final UserRepository users;
  private final StorageService storage;
  private final EventPublisher events;
  private final Clock clock;
  private final AuditLog audit;

  public ProfileService(
      UserRepository users,
      StorageService storage,
      EventPublisher events,
      Clock clock,
      AuditLog audit) {
    this.users = users;
    this.storage = storage;
    this.events = events;
    this.clock = clock;
    this.audit = audit;
  }

  public record Consent(boolean companionMemory) {}

  public record Profile(String alias, String avatarUrl, Consent consent) {}

  public record Session(Set<String> roles, boolean onboardingComplete) {}

  @Transactional(readOnly = true)
  public Session session(UUID id) {
    var user = users.findById(id).orElseThrow(DomainException::missing);
    var roles = new HashSet<String>();
    user.getRoles().forEach(role -> roles.add(role.getName()));
    roles.add("USER");
    return new Session(roles, user.isOnboardingComplete());
  }

  @Transactional
  public void completeOnboarding(UUID id) {
    users.lockById(id).orElseThrow(DomainException::missing).setOnboardingComplete(true);
  }

  @Transactional(readOnly = true)
  public Profile get(UUID id) {
    var u = users.findById(id).orElseThrow(DomainException::missing);
    return view(u);
  }

  @Transactional
  public Profile alias(UUID id, String alias) {
    if (alias == null || !alias.matches("[A-Za-z][A-Za-z0-9]{2,39}"))
      throw new DomainException(400, "INVALID_ALIAS", "Choose 3 to 40 letters and digits");
    var u = users.lockById(id).orElseThrow(DomainException::missing);
    if (!u.getAlias().equals(alias) && users.existsByAlias(alias))
      throw new DomainException(409, "ALIAS_TAKEN", "Alias is unavailable");
    u.setAlias(alias);
    events.publish(
        new DomainEvent(
            UUID.randomUUID(),
            "AliasChanged",
            1,
            clock.instant(),
            Map.of("userId", id, "alias", alias)));
    return view(u);
  }

  @Transactional
  public Consent consent(UUID id, Consent consent) {
    var u = users.lockById(id).orElseThrow(DomainException::missing);
    u.setCompanionMemory(consent.companionMemory());
    events.publish(
        new DomainEvent(
            UUID.randomUUID(),
            "ConsentChanged",
            1,
            clock.instant(),
            Map.of(
                "userId",
                id,
                "companionMemory",
                consent.companionMemory())));
    audit.record(AuditLog.Action.CONSENT_CHANGED, id);
    return consent;
  }

  @Transactional
  public StorageService.Upload avatar(UUID id, String contentType, long size) {
    if (!Set.of("image/jpeg", "image/png", "image/webp").contains(contentType)
        || size < 1
        || size > 5 * 1024 * 1024)
      throw new DomainException(400, "INVALID_UPLOAD", "Use a PNG, JPEG or WebP image up to 5 MiB");
    var u = users.lockById(id).orElseThrow(DomainException::missing);
    String key = "avatars/" + id + "/" + UUID.randomUUID();
    var result = storage.avatarUpload(key, contentType, size);
    if (result.uploadSupported()) u.setAvatarKey(key);
    return result;
  }

  public Consent consentOf(User u) {
    return new Consent(u.isCompanionMemory());
  }

  private Profile view(User u) {
    return new Profile(
        u.getAlias(),
        u.getAvatarKey() == null ? null : storage.download(u.getAvatarKey()),
        consentOf(u));
  }
}
