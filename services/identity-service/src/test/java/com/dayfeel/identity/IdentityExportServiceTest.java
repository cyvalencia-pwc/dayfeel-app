package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.*;
import com.dayfeel.identity.community.*;
import com.dayfeel.identity.privacy.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class IdentityExportServiceTest {
  @Mock UserRepository users;
  @Mock CircleRepository circles;
  @Mock MembershipRepository memberships;
  @Mock ReportRepository reports;
  @Mock ModerationActionRepository actions;
  @Mock PrivacyRequestRepository requests;
  IdentityExportService service;
  final TestClock clock = new TestClock();

  @BeforeEach
  void setup() {
    service = new IdentityExportService(users, circles, memberships, reports, actions, requests);
  }

  @Test
  void includesOwnedDataWithoutCredentials() {
    var u = new User(UUID.randomUUID(), "a@example.com", "SECRET_HASH", "alias", clock.instant());
    u.getRoles().add(new Role("USER"));
    when(users.findById(u.getId())).thenReturn(Optional.of(u));
    var c = new Circle(UUID.randomUUID(), "circle", u.getId());
    when(circles.findByOwnerId(u.getId())).thenReturn(List.of(c));
    when(memberships.findByUserId(u.getId()))
        .thenReturn(List.of(new Membership(c.getId(), u.getId(), Membership.MemberRole.OWNER)));
    when(reports.findByReporterIdOrTargetId(u.getId(), u.getId()))
        .thenReturn(
            List.of(
                new Report(
                    u.getId(),
                    UUID.randomUUID(),
                    c.getId(),
                    "post",
                    Report.Reason.SPAM,
                    clock.instant())));
    when(actions.findByActorIdOrTargetId(u.getId(), u.getId()))
        .thenReturn(
            List.of(
                new ModerationAction(
                    u.getId(), UUID.randomUUID(), c.getId(), "post", "WARN", clock.instant())));
    when(requests.findByUserId(u.getId()))
        .thenReturn(
            List.of(new PrivacyRequest(u.getId(), PrivacyRequest.Kind.EXPORT, clock.instant())));
    var data = service.export(u.getId());
    assertThat(data.ownedCircles()).hasSize(1);
    assertThat(data.memberships()).hasSize(1);
    assertThat(data.reports()).hasSize(1);
    assertThat(data.moderationActions()).hasSize(1);
    assertThat(data.privacyRequests()).hasSize(1);
    assertThat(data.toString()).doesNotContain("SECRET_HASH");
    assertThat(data.roles()).containsExactly("USER");
  }

  @Test
  void absentUserRejected() {
    assertThatThrownBy(() -> service.export(UUID.randomUUID())).isInstanceOf(DomainException.class);
    verifyNoInteractions(circles, memberships, reports, actions, requests);
  }
}
