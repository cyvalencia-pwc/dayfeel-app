package com.dayfeel.identity.community;

import java.time.Clock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class RestrictionExpiryJob {
  private final MembershipRepository members;
  private final Clock clock;

  public RestrictionExpiryJob(MembershipRepository members, Clock clock) {
    this.members = members;
    this.clock = clock;
  }

  @Scheduled(fixedDelayString = "${dayfeel.restriction-sweep-ms:60000}")
  @Transactional
  public void run() {
    members.liftMutes(clock.instant());
    members.liftBans(clock.instant());
  }
}
