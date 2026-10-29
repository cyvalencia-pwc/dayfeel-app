package com.dayfeel.identity.community;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface MembershipRepository extends JpaRepository<Membership, UUID> {
  Optional<Membership> findByCircleIdAndUserId(UUID circleId, UUID userId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select m from Membership m where m.circleId=:circle and m.userId=:user")
  Optional<Membership> lockMember(@Param("circle") UUID circle, @Param("user") UUID user);

  @Modifying
  @Query("update Membership m set m.mutedUntil=null where m.mutedUntil<=:now")
  int liftMutes(@Param("now") Instant now);

  @Modifying
  @Query("update Membership m set m.bannedUntil=null where m.bannedUntil<=:now")
  int liftBans(@Param("now") Instant now);

  java.util.List<Membership> findByUserId(UUID userId);
}
