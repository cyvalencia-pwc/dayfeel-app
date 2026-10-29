package com.dayfeel.identity.common;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class AuditLog {
  private static final Logger LOG = LoggerFactory.getLogger(AuditLog.class);

  public enum Action {
    REGISTER,
    LOGIN,
    LOGIN_FAILED,
    REFRESH_REUSE,
    LOGOUT,
    CONSENT_CHANGED,
    MODERATION,
    EXPORT_REQUESTED,
    DELETION_REQUESTED,
    DELETION_COMPLETED,
    EVENT_FAILED
  }

  public void record(Action action, UUID actor) {
    LOG.info("audit action={} actor={}", action, actor);
  }
}
