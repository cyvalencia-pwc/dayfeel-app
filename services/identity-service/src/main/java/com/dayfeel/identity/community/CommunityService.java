package com.dayfeel.identity.community;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.*;
import com.dayfeel.identity.events.*;
import java.time.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommunityService {
  private final CircleRepository circles;
  private final MembershipRepository members;
  private final UserRepository users;
  private final ReportRepository reports;
  private final ModerationActionRepository actions;
  private final ModerationPolicy policy;
  private final EventPublisher events;
  private final Clock clock;
  private final AuditLog audit;

  public CommunityService(
      CircleRepository circles,
      MembershipRepository members,
      UserRepository users,
      ReportRepository reports,
      ModerationActionRepository actions,
      ModerationPolicy policy,
      EventPublisher events,
      Clock clock,
      AuditLog audit) {
    this.circles = circles;
    this.members = members;
    this.users = users;
    this.reports = reports;
    this.actions = actions;
    this.policy = policy;
    this.events = events;
    this.clock = clock;
    this.audit = audit;
  }

  public enum Action {
    MUTE,
    BAN,
    UNBAN,
    REMOVE_CONTENT
  }

  public record CircleView(UUID id, String name, boolean joined) {}

  public record MemberView(
      boolean active, Membership.MemberRole role, Instant mutedUntil, Instant bannedUntil) {}

  public record Restriction(boolean member, boolean muted, boolean banned) {}

  public record ReportView(
      UUID id,
      UUID targetId,
      UUID circleId,
      String contentId,
      Report.Reason reason,
      String source,
      Instant createdAt) {}

  private void requireReviewer(UUID actorId, UUID circleId) {
    var actor = users.findById(actorId).orElseThrow(DomainException::missing);
    var member = members.findByCircleIdAndUserId(circleId, actorId).orElse(null);
    if (actor.getStatus() != User.Status.ACTIVE
        || (member != null && member.restricted(clock.instant())))
      throw DomainException.forbidden();
    if (actor.hasRole("ADMIN") || actor.hasRole("MODERATOR")) return;
    if (member == null || !member.isActive() || member.getRole() == Membership.MemberRole.MEMBER)
      throw DomainException.forbidden();
  }

  private ReportView reportView(Report r) {
    return new ReportView(
        r.getId(),
        r.getTargetId(),
        r.getCircleId(),
        r.getContentId(),
        r.getReason(),
        r.getReporterId() == null ? "AI" : "USER",
        r.getCreatedAt());
  }

  @Transactional(readOnly = true)
  public List<ReportView> reportQueue(UUID actor, UUID circle, int page) {
    if (page < 0) throw new DomainException(400, "INVALID_PAGE", "Invalid page");
    requireReviewer(actor, circle);
    return reports
        .findByCircleId(
            circle, PageRequest.of(page, 20, Sort.by(Sort.Direction.DESC, "createdAt", "id")))
        .map(this::reportView)
        .getContent();
  }

  @Transactional(readOnly = true)
  public ReportView reportDetail(UUID actor, UUID reportId) {
    var report = reports.findById(reportId).orElseThrow(DomainException::missing);
    requireReviewer(actor, report.getCircleId());
    return reportView(report);
  }

  @Transactional(readOnly = true)
  public List<CircleView> list(UUID actor, int page, int size) {
    if (page < 0 || size < 1 || size > 100)
      throw new DomainException(400, "INVALID_PAGE", "Invalid page");
    var joined = new HashSet<UUID>();
    for (var membership : members.findByUserId(actor)) {
      if (membership.isActive()) joined.add(membership.getCircleId());
    }
    return circles
        .findAll(PageRequest.of(page, size, Sort.by("id")))
        .map(c -> new CircleView(c.getId(), c.getName(), joined.contains(c.getId())))
        .getContent();
  }

  @Transactional
  public CircleView create(UUID actor, String name) {
    users.lockById(actor).orElseThrow(DomainException::missing);
    var c = circles.save(new Circle(UUID.randomUUID(), name, actor));
    members.save(new Membership(c.getId(), actor, Membership.MemberRole.OWNER));
    return new CircleView(c.getId(), name, true);
  }

  @Transactional
  public MemberView join(UUID actor, UUID circle) {
    users.lockById(actor).orElseThrow(DomainException::missing);
    circles.lockById(circle).orElseThrow(DomainException::missing);
    var m =
        members
            .lockMember(circle, actor)
            .orElseGet(() -> new Membership(circle, actor, Membership.MemberRole.MEMBER));
    if (m.restricted(clock.instant())) throw DomainException.forbidden();
    m.setActive(true);
    members.save(m);
    return view(m);
  }

  @Transactional
  public void leave(UUID actor, UUID circle) {
    users.lockById(actor).orElseThrow(DomainException::missing);
    circles.lockById(circle).orElseThrow(DomainException::missing);
    var m = members.lockMember(circle, actor).orElseThrow(DomainException::missing);
    if (m.getRole() == Membership.MemberRole.OWNER || m.restricted(clock.instant()))
      throw DomainException.forbidden();
    m.setActive(false); // Never delete restriction history on leave.
  }

  @Transactional
  public void promote(UUID actor, UUID circle, UUID target) {
    var c = circles.lockById(circle).orElseThrow(DomainException::missing);
    if (!actor.equals(c.getOwnerId()) || actor.equals(target)) throw DomainException.forbidden();
    var m = members.lockMember(circle, target).orElseThrow(DomainException::missing);
    if (!m.isActive() || m.restricted(clock.instant())) throw DomainException.forbidden();
    m.setRole(Membership.MemberRole.MODERATOR);
  }

  @Transactional
  public UUID report(UUID actor, UUID target, UUID circle, String content, Report.Reason reason) {
    if (actor != null && actor.equals(target)) throw new DomainException(400, "INVALID_REPORT", "Cannot report your own content");
    if (actor != null) users.findById(actor).orElseThrow(DomainException::missing);
    users.findById(target).orElseThrow(DomainException::missing);
    circles.findById(circle).orElseThrow(DomainException::missing);
    return reports
        .save(new Report(actor, target, circle, content, reason, clock.instant()))
        .getId();
  }

  @Transactional
  public void moderate(
      UUID actorId, UUID targetId, UUID circleId, Action action, Instant until, String content) {
    // Lock users in deterministic order before circle/member locks.
    var ids = new TreeSet<UUID>(List.of(actorId, targetId));
    var locked = new HashMap<UUID, User>();
    for (var id : ids) locked.put(id, users.lockById(id).orElseThrow(DomainException::missing));
    var actor = locked.get(actorId);
    var target = locked.get(targetId);
    var circle = circles.lockById(circleId).orElseThrow(DomainException::missing);
    var actorMember = members.lockMember(circleId, actorId).orElse(null);
    policy.authorize(actor, target, circle, actorMember);
    if (actorMember != null && actorMember.restricted(clock.instant()))
      throw DomainException.forbidden();
    var targetMember = members.lockMember(circleId, targetId).orElseThrow(DomainException::missing);
    if ((action == Action.MUTE || action == Action.BAN)
        && (until == null
            || !until.isAfter(clock.instant())
            || until.isAfter(clock.instant().plus(Duration.ofDays(365)))))
      throw new DomainException(400, "INVALID_DURATION", "Choose a future expiry within one year");
    switch (action) {
      case MUTE -> targetMember.setMutedUntil(until);
      case BAN -> targetMember.setBannedUntil(until);
      case UNBAN -> targetMember.setBannedUntil(null);
      case REMOVE_CONTENT -> {
        if (content == null || content.isBlank())
          throw new DomainException(400, "CONTENT_REQUIRED", "Content reference required");
      }
    }
    actions.save(
        new ModerationAction(actorId, targetId, circleId, content, action.name(), clock.instant()));
    var payload = new HashMap<String, Object>();
    payload.put("userId", targetId);
    payload.put("circleId", circleId);
    payload.put("action", action.name());
    if (content != null) payload.put("contentId", content);
    if (until != null) payload.put("until", until.toString());
    events.publish(
        new DomainEvent(UUID.randomUUID(), "ModerationActionCreated", 1, clock.instant(), payload));
    audit.record(AuditLog.Action.MODERATION, actorId);
  }

  @Transactional(readOnly = true)
  public Restriction restrictions(UUID circle, UUID user) {
    var m = members.findByCircleIdAndUserId(circle, user).orElse(null);
    var now = clock.instant();
    return m == null
        ? new Restriction(false, false, false)
        : new Restriction(
            m.isActive(),
            m.getMutedUntil() != null && m.getMutedUntil().isAfter(now),
            m.getBannedUntil() != null && m.getBannedUntil().isAfter(now));
  }

  @Transactional(readOnly = true)
  public MemberView membership(UUID circle, UUID user) {
    return members
        .findByCircleIdAndUserId(circle, user)
        .map(this::view)
        .orElseThrow(DomainException::missing);
  }

  private MemberView view(Membership m) {
    return new MemberView(m.isActive(), m.getRole(), m.getMutedUntil(), m.getBannedUntil());
  }
}
