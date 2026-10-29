package com.dayfeel.identity.privacy;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.*;
import com.dayfeel.identity.events.*;
import com.dayfeel.identity.profile.StorageService;
import java.time.Clock;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PrivacyService {
  private final UserRepository users;
  private final AuthService auth;
  private final PrivacyRequestRepository requests;
  private final EventPublisher events;
  private final StorageService storage;
  private final Clock clock;
  private final AuditLog audit;

  public PrivacyService(
      UserRepository users,
      AuthService auth,
      PrivacyRequestRepository requests,
      EventPublisher events,
      StorageService storage,
      Clock clock,
      AuditLog audit) {
    this.users = users;
    this.auth = auth;
    this.requests = requests;
    this.events = events;
    this.storage = storage;
    this.clock = clock;
    this.audit = audit;
  }

  public record View(
      UUID id, PrivacyRequest.Kind kind, PrivacyRequest.Status status, String downloadUrl) {}

  @Transactional
  public View request(UUID userId, PrivacyRequest.Kind kind) {
    var user = users.lockById(userId).orElseThrow(DomainException::missing);
    if (user.getStatus() != User.Status.ACTIVE) throw DomainException.forbidden();
    var existing =
        requests.findFirstByUserIdAndKindAndStatusOrderByCreatedAtDesc(
            userId, kind, PrivacyRequest.Status.PENDING);
    if (existing.isPresent()) return view(existing.get(), false);
    var r = requests.save(new PrivacyRequest(userId, kind, clock.instant()));
    if (kind == PrivacyRequest.Kind.DELETION) {
      user.setStatus(User.Status.PENDING_DELETION);
      auth.revoke(user);
    }
    events.publish(
        new DomainEvent(
            UUID.randomUUID(),
            kind == PrivacyRequest.Kind.DELETION ? "UserDeletionRequested" : "DataExportRequested",
            1,
            clock.instant(),
            Map.of("userId", userId, "requestId", r.getId())));
    audit.record(
        kind == PrivacyRequest.Kind.DELETION
            ? AuditLog.Action.DELETION_REQUESTED
            : AuditLog.Action.EXPORT_REQUESTED,
        userId);
    return view(r, false);
  }

  @Transactional(readOnly = true)
  public View status(UUID user, UUID request) {
    var r = requests.findById(request).orElseThrow(DomainException::missing);
    if (!user.equals(r.getUserId())) throw DomainException.missing();
    return view(r, true);
  }

  @Transactional
  public void complete(UUID requestId, UUID userId, PrivacyRequest.Kind kind, String objectKey) {
    // Same lock order as request creation: user, then request.
    var user = users.lockById(userId);
    var r = requests.lockById(requestId).orElseThrow(DomainException::missing);
    if (r.getKind() != kind)
      throw new DomainException(409, "CALLBACK_MISMATCH", "Completion does not match request");
    if (r.getStatus() == PrivacyRequest.Status.COMPLETED) {
      if (r.getUserId() != null && !userId.equals(r.getUserId())) throw DomainException.forbidden();
      return;
    }
    if (!userId.equals(r.getUserId())) throw DomainException.forbidden();
    var u = user.orElseThrow(DomainException::missing);
    if (kind == PrivacyRequest.Kind.EXPORT) {
      if (u.getStatus() != User.Status.ACTIVE) throw DomainException.forbidden();
      if (objectKey == null
          || !objectKey.matches("exports/" + requestId + "/[A-Za-z0-9_-]+\\.(zip|json)"))
        throw new DomainException(400, "INVALID_EXPORT_KEY", "Export object key is invalid");
      r.setObjectKey(objectKey);
    } else {
      if (u.getStatus() != User.Status.PENDING_DELETION)
        throw new DomainException(409, "DELETION_NOT_PENDING", "Deletion has not been requested");
      r.setUserId(null);
      users.delete(u);
      audit.record(AuditLog.Action.DELETION_COMPLETED, userId);
    }
    r.setStatus(PrivacyRequest.Status.COMPLETED);
  }

  private View view(PrivacyRequest r, boolean download) {
    return new View(
        r.getId(),
        r.getKind(),
        r.getStatus(),
        download && r.getObjectKey() != null ? storage.download(r.getObjectKey()) : null);
  }
}
