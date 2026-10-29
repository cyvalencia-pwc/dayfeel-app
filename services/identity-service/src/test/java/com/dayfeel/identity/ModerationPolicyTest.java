package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.*;
import com.dayfeel.identity.community.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;

class ModerationPolicyTest {
  final TestClock clock = new TestClock();
  final ModerationPolicy policy = new ModerationPolicy();

  User user() {
    return new User(UUID.randomUUID(), "x@example.com", "hash", "alias", clock.instant());
  }

  @ParameterizedTest
  @ValueSource(strings = {"ADMIN", "MODERATOR"})
  void globalRolesCanModerate(String role) {
    var actor = user();
    actor.getRoles().add(new Role(role));
    var target = user();
    policy.authorize(
        actor, target, new Circle(UUID.randomUUID(), "circle", UUID.randomUUID()), null);
  }

  @ParameterizedTest
  @EnumSource(
      value = Membership.MemberRole.class,
      names = {"OWNER", "MODERATOR"})
  void localRolesCanModerate(Membership.MemberRole role) {
    var actor = user();
    var target = user();
    var circle = new Circle(UUID.randomUUID(), "circle", UUID.randomUUID());
    policy.authorize(actor, target, circle, new Membership(circle.getId(), actor.getId(), role));
  }

  @ParameterizedTest
  @ValueSource(strings = {"USER", "MODERATOR", "ADMIN"})
  void noSelfModeration(String role) {
    var actor = user();
    actor.getRoles().add(new Role(role));
    assertThatThrownBy(
            () ->
                policy.authorize(
                    actor, actor, new Circle(UUID.randomUUID(), "circle", UUID.randomUUID()), null))
        .isInstanceOf(DomainException.class);
  }

  @ParameterizedTest
  @ValueSource(strings = {"USER", "MODERATOR", "ADMIN"})
  void adminsProtected(String role) {
    var actor = user();
    actor.getRoles().add(new Role(role));
    var target = user();
    target.getRoles().add(new Role("ADMIN"));
    assertThatThrownBy(
            () ->
                policy.authorize(
                    actor,
                    target,
                    new Circle(UUID.randomUUID(), "circle", UUID.randomUUID()),
                    null))
        .isInstanceOf(DomainException.class);
  }

  @ParameterizedTest
  @ValueSource(strings = {"USER", "MODERATOR", "ADMIN"})
  void ownerProtected(String role) {
    var actor = user();
    actor.getRoles().add(new Role(role));
    var target = user();
    assertThatThrownBy(
            () ->
                policy.authorize(
                    actor, target, new Circle(UUID.randomUUID(), "circle", target.getId()), null))
        .isInstanceOf(DomainException.class);
  }

  @Test
  void wrongCircleDenied() {
    var actor = user();
    var target = user();
    var c = new Circle(UUID.randomUUID(), "circle", UUID.randomUUID());
    assertThatThrownBy(
            () ->
                policy.authorize(
                    actor,
                    target,
                    c,
                    new Membership(
                        UUID.randomUUID(), actor.getId(), Membership.MemberRole.MODERATOR)))
        .isInstanceOf(DomainException.class);
  }

  @Test
  void wrongMemberDenied() {
    var actor = user();
    var target = user();
    var c = new Circle(UUID.randomUUID(), "circle", UUID.randomUUID());
    assertThatThrownBy(
            () ->
                policy.authorize(
                    actor,
                    target,
                    c,
                    new Membership(c.getId(), UUID.randomUUID(), Membership.MemberRole.MODERATOR)))
        .isInstanceOf(DomainException.class);
  }

  @Test
  void inactiveModeratorDenied() {
    var actor = user();
    var target = user();
    var c = new Circle(UUID.randomUUID(), "circle", UUID.randomUUID());
    var m = new Membership(c.getId(), actor.getId(), Membership.MemberRole.MODERATOR);
    m.setActive(false);
    assertThatThrownBy(() -> policy.authorize(actor, target, c, m))
        .isInstanceOf(DomainException.class);
  }

  @Test
  void ordinaryMemberDenied() {
    var actor = user();
    var target = user();
    var c = new Circle(UUID.randomUUID(), "circle", UUID.randomUUID());
    assertThatThrownBy(
            () ->
                policy.authorize(
                    actor,
                    target,
                    c,
                    new Membership(c.getId(), actor.getId(), Membership.MemberRole.MEMBER)))
        .isInstanceOf(DomainException.class);
  }

  @Test
  void pendingModeratorDenied() {
    var actor = user();
    actor.setStatus(User.Status.PENDING_DELETION);
    actor.getRoles().add(new Role("MODERATOR"));
    assertThatThrownBy(
            () ->
                policy.authorize(
                    actor,
                    user(),
                    new Circle(UUID.randomUUID(), "circle", UUID.randomUUID()),
                    null))
        .isInstanceOf(DomainException.class);
  }
}
