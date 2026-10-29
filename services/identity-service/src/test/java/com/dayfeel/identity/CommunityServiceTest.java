package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.*;
import com.dayfeel.identity.community.*;
import com.dayfeel.identity.events.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CommunityServiceTest {
  @Mock CircleRepository circles;
  @Mock MembershipRepository members;
  @Mock UserRepository users;
  @Mock ReportRepository reports;
  @Mock ModerationActionRepository actions;
  @Mock EventPublisher events;
  @Mock AuditLog audit;
  final TestClock clock = new TestClock();
  CommunityService service;
  User actor, target;
  Circle circle;
  Membership member;

  @BeforeEach
  void setup() {
    actor = new User(UUID.randomUUID(), "a@example.com", "hash", "a", clock.instant());
    target = new User(UUID.randomUUID(), "b@example.com", "hash", "b", clock.instant());
    circle = new Circle(UUID.randomUUID(), "circle", UUID.randomUUID());
    member = new Membership(circle.getId(), actor.getId(), Membership.MemberRole.MEMBER);
    service =
        new CommunityService(
            circles,
            members,
            users,
            reports,
            actions,
            new ModerationPolicy(),
            events,
            clock,
            audit);
  }

  void membershipSetup() {
    when(users.lockById(actor.getId())).thenReturn(Optional.of(actor));
    when(circles.lockById(circle.getId())).thenReturn(Optional.of(circle));
    when(members.lockMember(circle.getId(), actor.getId())).thenReturn(Optional.of(member));
  }

  @Test
  void ordinaryMemberCannotReadReports() {
    when(users.findById(actor.getId())).thenReturn(Optional.of(actor));
    when(members.findByCircleIdAndUserId(circle.getId(), actor.getId()))
        .thenReturn(Optional.of(member));
    assertThatThrownBy(() -> service.reportQueue(actor.getId(), circle.getId(), 0))
        .isInstanceOf(DomainException.class);
    verifyNoInteractions(reports);
  }

  @Test
  void circleListShowsOnlyActiveMembershipsForCurrentUser() {
    var unjoined = new Circle(UUID.randomUUID(), "Other circle", target.getId());
    when(circles.findAll(any(org.springframework.data.domain.Pageable.class)))
        .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(circle, unjoined)));
    when(members.findByUserId(actor.getId())).thenReturn(List.of(member));
    var result = service.list(actor.getId(), 0, 20);
    assertThat(result.get(0).joined()).isTrue();
    assertThat(result.get(1).joined()).isFalse();
    member.setActive(false);
    assertThat(service.list(actor.getId(), 0, 20)).allMatch(c -> !c.joined());
    when(members.findByUserId(target.getId())).thenReturn(List.of());
    assertThat(service.list(target.getId(), 0, 20)).allMatch(c -> !c.joined());
  }

  @Test
  void moderatorCanReadReportsWithoutReporterIdentity() {
    actor.getRoles().add(new Role("MODERATOR"));
    when(users.findById(actor.getId())).thenReturn(Optional.of(actor));
    var report =
        new Report(
            null, target.getId(), circle.getId(), "content", Report.Reason.UNSAFE, clock.instant());
    when(reports.findByCircleId(eq(circle.getId()), any()))
        .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(report)));
    var queue = service.reportQueue(actor.getId(), circle.getId(), 0);
    assertThat(queue).hasSize(1);
    assertThat(queue.getFirst().source()).isEqualTo("AI");
    assertThat(queue.getFirst().targetId()).isEqualTo(target.getId());
  }

  @Test
  void reportDetailRequiresAuthorityInItsCircle() {
    var report =
        new Report(
            null, target.getId(), circle.getId(), "content", Report.Reason.UNSAFE, clock.instant());
    when(reports.findById(report.getId())).thenReturn(Optional.of(report));
    when(users.findById(actor.getId())).thenReturn(Optional.of(actor));
    assertThatThrownBy(() -> service.reportDetail(actor.getId(), report.getId()))
        .isInstanceOf(DomainException.class);
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void restrictedMemberCannotLeave(boolean mute) {
    membershipSetup();
    if (mute) member.setMutedUntil(clock.instant().plusSeconds(60));
    else member.setBannedUntil(clock.instant().plusSeconds(60));
    assertThatThrownBy(() -> service.leave(actor.getId(), circle.getId()))
        .isInstanceOf(DomainException.class);
    assertThat(member.isActive()).isTrue();
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void restrictedMemberCannotRejoin(boolean mute) {
    membershipSetup();
    member.setActive(false);
    if (mute) member.setMutedUntil(clock.instant().plusSeconds(60));
    else member.setBannedUntil(clock.instant().plusSeconds(60));
    assertThatThrownBy(() -> service.join(actor.getId(), circle.getId()))
        .isInstanceOf(DomainException.class);
    assertThat(member.isActive()).isFalse();
  }

  @Test
  void leavesWithoutDeletingHistory() {
    membershipSetup();
    service.leave(actor.getId(), circle.getId());
    assertThat(member.isActive()).isFalse();
    verify(members, never()).delete(any());
  }

  @Test
  void ownerCannotLeave() {
    membershipSetup();
    member.setRole(Membership.MemberRole.OWNER);
    assertThatThrownBy(() -> service.leave(actor.getId(), circle.getId()))
        .isInstanceOf(DomainException.class);
  }

  @Test
  void rejoinAfterExpiry() {
    membershipSetup();
    member.setBannedUntil(clock.instant());
    member.setActive(false);
    assertThat(service.join(actor.getId(), circle.getId()).active()).isTrue();
  }

  @Test
  void restrictionBoundary() {
    member.setMutedUntil(clock.instant());
    assertThat(member.restricted(clock.instant())).isFalse();
  }

  @Test
  void noMembershipHasNoRestrictions() {
    assertThat(service.restrictions(circle.getId(), actor.getId()))
        .isEqualTo(new CommunityService.Restriction(false, false, false));
  }

  @Test
  void restrictionsRetainedForInactiveMember() {
    member.setActive(false);
    member.setBannedUntil(clock.instant().plusSeconds(60));
    when(members.findByCircleIdAndUserId(circle.getId(), actor.getId()))
        .thenReturn(Optional.of(member));
    assertThat(service.restrictions(circle.getId(), actor.getId()).banned()).isTrue();
  }

  @Test
  void sweepUsesClock() {
    new RestrictionExpiryJob(members, clock).run();
    verify(members).liftMutes(clock.instant());
    verify(members).liftBans(clock.instant());
  }

  void moderationSetup() {
    actor.getRoles().add(new Role("MODERATOR"));
    when(users.lockById(actor.getId())).thenReturn(Optional.of(actor));
    when(users.lockById(target.getId())).thenReturn(Optional.of(target));
    when(circles.lockById(circle.getId())).thenReturn(Optional.of(circle));
    member = new Membership(circle.getId(), target.getId(), Membership.MemberRole.MEMBER);
    doReturn(Optional.empty()).when(members).lockMember(circle.getId(), actor.getId());
    doReturn(Optional.of(member)).when(members).lockMember(circle.getId(), target.getId());
  }

  @ParameterizedTest
  @EnumSource(CommunityService.Action.class)
  void authorizedActionPublishes(CommunityService.Action action) {
    moderationSetup();
    service.moderate(
        actor.getId(),
        target.getId(),
        circle.getId(),
        action,
        clock.instant().plusSeconds(60),
        "content-1");
    verify(actions).save(any());
    verify(events).publish(argThat(e -> e.type().equals("ModerationActionCreated")));
    if (action == CommunityService.Action.MUTE) assertThat(member.getMutedUntil()).isNotNull();
    if (action == CommunityService.Action.BAN) assertThat(member.getBannedUntil()).isNotNull();
  }

  @ParameterizedTest
  @ValueSource(longs = {-1, 0, 31622400})
  void invalidExpiryRejected(long seconds) {
    moderationSetup();
    assertThatThrownBy(
            () ->
                service.moderate(
                    actor.getId(),
                    target.getId(),
                    circle.getId(),
                    CommunityService.Action.BAN,
                    clock.instant().plusSeconds(seconds),
                    null))
        .isInstanceOf(DomainException.class);
    verifyNoInteractions(events);
  }

  @Test
  void removalRequiresReference() {
    moderationSetup();
    assertThatThrownBy(
            () ->
                service.moderate(
                    actor.getId(),
                    target.getId(),
                    circle.getId(),
                    CommunityService.Action.REMOVE_CONTENT,
                    null,
                    null))
        .isInstanceOf(DomainException.class);
  }

  @ParameterizedTest
  @ValueSource(ints = {0, -1, 101})
  void badPageSizeRejected(int size) {
    assertThatThrownBy(() -> service.list(actor.getId(), 0, size)).isInstanceOf(DomainException.class);
  }
}
