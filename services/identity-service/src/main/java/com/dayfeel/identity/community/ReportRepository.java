package com.dayfeel.identity.community;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, UUID> {
  org.springframework.data.domain.Page<Report> findByCircleId(
      UUID circleId, org.springframework.data.domain.Pageable pageable);

  java.util.List<Report> findByReporterIdOrTargetId(UUID reporterId, UUID targetId);
}
