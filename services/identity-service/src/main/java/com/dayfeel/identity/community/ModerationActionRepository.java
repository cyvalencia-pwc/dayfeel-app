package com.dayfeel.identity.community;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModerationActionRepository extends JpaRepository<ModerationAction, UUID> {
  java.util.List<ModerationAction> findByActorIdOrTargetId(UUID actorId, UUID targetId);
}
