package com.dayfeel.identity.events;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, UUID> {
  @Modifying
  @Query(
      value = "INSERT IGNORE INTO processed_events(id,processed_at) VALUES (:id,:at)",
      nativeQuery = true)
  int claim(@Param("id") String id, @Param("at") Instant at);
}
