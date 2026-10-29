package com.dayfeel.identity.events;

import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface OutboxRepository extends JpaRepository<OutboxEvent, UUID> {
  List<OutboxEvent> findTop50ByPublishedFalseOrderByOccurredAtAsc();

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from OutboxEvent e where e.id=:id")
  Optional<OutboxEvent> lockById(@Param("id") UUID id);
}
