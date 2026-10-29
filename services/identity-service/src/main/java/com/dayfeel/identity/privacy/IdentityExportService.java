package com.dayfeel.identity.privacy;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.DomainException;
import com.dayfeel.identity.community.*;
import com.dayfeel.identity.profile.*;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityExportService {
  private final UserRepository users;
  private final CircleRepository circles;
  private final MembershipRepository memberships;
  private final ReportRepository reports;
  private final ModerationActionRepository actions;
  private final PrivacyRequestRepository requests;

  public IdentityExportService(
      UserRepository users,
      CircleRepository circles,
      MembershipRepository memberships,
      ReportRepository reports,
      ModerationActionRepository actions,
      PrivacyRequestRepository requests) {
    this.users = users;
    this.circles = circles;
    this.memberships = memberships;
    this.reports = reports;
    this.actions = actions;
    this.requests = requests;
  }

  public record MembershipData(
      UUID circleId,
      Membership.MemberRole role,
      boolean active,
      Instant mutedUntil,
      Instant bannedUntil) {}

  public record ReportData(
      UUID id, UUID circleId, String contentId, Report.Reason reason, Instant createdAt) {}

  public record ActionData(
      UUID id,
      UUID circleId,
      String contentId,
      String action,
      Instant createdAt,
      boolean performedByUser) {}

  public record RequestData(
      UUID id, PrivacyRequest.Kind kind, PrivacyRequest.Status status, Instant createdAt) {}

  public record Data(
      UUID id,
      String email,
      String alias,
      String avatarKey,
      Instant createdAt,
      ProfileService.Consent consent,
      List<String> roles,
      List<CommunityService.CircleView> ownedCircles,
      List<MembershipData> memberships,
      List<ReportData> reports,
      List<ActionData> moderationActions,
      List<RequestData> privacyRequests) {}

  @Transactional(readOnly = true)
  public Data export(UUID id) {
    var u = users.findById(id).orElseThrow(DomainException::missing);
    var userMemberships = memberships.findByUserId(id);
    return new Data(
        id,
        u.getEmail(),
        u.getAlias(),
        u.getAvatarKey(),
        u.getCreatedAt(),
        new ProfileService.Consent(u.isCompanionMemory()),
        u.getRoles().stream().map(Role::getName).sorted().toList(),
        circles.findByOwnerId(id).stream()
            .map(c -> new CommunityService.CircleView(c.getId(), c.getName(),
                userMemberships.stream().anyMatch(m -> m.isActive() && m.getCircleId().equals(c.getId()))))
            .toList(),
        userMemberships.stream()
            .map(
                m ->
                    new MembershipData(
                        m.getCircleId(),
                        m.getRole(),
                        m.isActive(),
                        m.getMutedUntil(),
                        m.getBannedUntil()))
            .toList(),
        reports.findByReporterIdOrTargetId(id, id).stream()
            .map(
                r ->
                    new ReportData(
                        r.getId(),
                        r.getCircleId(),
                        r.getContentId(),
                        r.getReason(),
                        r.getCreatedAt()))
            .toList(),
        actions.findByActorIdOrTargetId(id, id).stream()
            .map(
                a ->
                    new ActionData(
                        a.getId(),
                        a.getCircleId(),
                        a.getContentId(),
                        a.getAction(),
                        a.getCreatedAt(),
                        id.equals(a.getActorId())))
            .toList(),
        requests.findByUserId(id).stream()
            .map(r -> new RequestData(r.getId(), r.getKind(), r.getStatus(), r.getCreatedAt()))
            .toList());
  }
}
