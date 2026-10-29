package com.dayfeel.identity.events;

import com.dayfeel.identity.common.AuditLog;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "dayfeel.events.mode", havingValue = "kafka")
public class OutboxJob {
  private final OutboxRepository outbox;
  private final OutboxDelivery delivery;
  private final AuditLog audit;

  public OutboxJob(OutboxRepository outbox, OutboxDelivery delivery, AuditLog audit) {
    this.outbox = outbox;
    this.delivery = delivery;
    this.audit = audit;
  }

  @Scheduled(fixedDelayString = "${dayfeel.events.outbox-delay-ms:1000}")
  public void run() {
    try (var ignored = MDC.putCloseable("traceId", UUID.randomUUID().toString())) {
      for (var e : outbox.findTop50ByPublishedFalseOrderByOccurredAtAsc()) {
        try {
          delivery.deliver(e.getId());
        } catch (RuntimeException failure) {
          audit.record(AuditLog.Action.EVENT_FAILED, null);
        }
      }
    }
  }
}
