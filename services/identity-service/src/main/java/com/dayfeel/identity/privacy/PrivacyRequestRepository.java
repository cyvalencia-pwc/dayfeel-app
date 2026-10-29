package com.dayfeel.identity.privacy;

import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface PrivacyRequestRepository extends JpaRepository<PrivacyRequest, UUID> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select r from PrivacyRequest r where r.id=:id")
  Optional<PrivacyRequest> lockById(@Param("id") UUID id);

  Optional<PrivacyRequest> findFirstByUserIdAndKindAndStatusOrderByCreatedAtDesc(
      UUID userId, PrivacyRequest.Kind kind, PrivacyRequest.Status status);

  java.util.List<PrivacyRequest> findByUserId(UUID userId);
}
