package com.dayfeel.identity.events;

import org.slf4j.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "dayfeel.events.mode", havingValue = "log", matchIfMissing = true)
public class LogEventPublisher implements EventPublisher {
  private static final Logger LOG = LoggerFactory.getLogger(LogEventPublisher.class);

  public void publish(DomainEvent event) {
    LOG.info("event id={} type={} version={}", event.id(), event.type(), event.version());
  }
}
