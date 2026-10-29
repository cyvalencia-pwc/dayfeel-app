package com.dayfeel.identity.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "dayfeel.events.mode", havingValue = "kafka")
public class KafkaContentListener {
  private final ObjectMapper mapper;
  private final ContentEventHandler handler;

  public KafkaContentListener(ObjectMapper mapper, ContentEventHandler handler) {
    this.mapper = mapper;
    this.handler = handler;
  }

  @KafkaListener(
      topics = "${dayfeel.events.inbound-topic:content-events}",
      groupId = "${dayfeel.events.group-id:dayfeel-identity}",
      containerFactory = "identityKafkaListenerContainerFactory")
  public void consume(String body) {
    try (var ignored = MDC.putCloseable("traceId", UUID.randomUUID().toString())) {
      try {
        handler.handle(mapper.readValue(body, DomainEvent.class));
      } catch (Exception failure) {
        throw new IllegalStateException("Content event processing failed");
      }
    }
  }
}
