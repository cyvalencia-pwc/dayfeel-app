package com.dayfeel.identity.community;

import com.dayfeel.identity.auth.User;
import com.dayfeel.identity.common.DomainException;
import org.springframework.stereotype.Component;

@Component
public class ModerationPolicy {
  public void authorize(User actor, User target, Circle circle, Membership membership) {
    if (actor.getId().equals(target.getId())
        || target.hasRole("ADMIN")
        || target.getId().equals(circle.getOwnerId())) throw DomainException.forbidden();
    if (actor.getStatus() != User.Status.ACTIVE) throw DomainException.forbidden();
    if (actor.hasRole("ADMIN") || actor.hasRole("MODERATOR")) return;
    if (membership == null
        || !membership.isActive()
        || !membership.getCircleId().equals(circle.getId())
        || !membership.getUserId().equals(actor.getId())) throw DomainException.forbidden();
    if (membership.getRole() != Membership.MemberRole.OWNER
        && membership.getRole() != Membership.MemberRole.MODERATOR)
      throw DomainException.forbidden();
  }
}
