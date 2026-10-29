package com.dayfeel.identity.community;

import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface CircleRepository extends JpaRepository<Circle, UUID> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select c from Circle c where c.id=:id")
  Optional<Circle> lockById(@Param("id") UUID id);

  java.util.List<Circle> findByOwnerId(UUID ownerId);
}
