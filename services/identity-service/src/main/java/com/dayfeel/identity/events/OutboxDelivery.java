package com.dayfeel.identity.events;

import com.dayfeel.identity.config.DayfeelProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@ConditionalOnProperty(name = "dayfeel.events.mode", havingValue = "kafka")
public class OutboxDelivery {
  private final OutboxRepository outbox;
  private final KafkaDelivery kafka;
  private final ObjectMapper mapper;
  private final String topic;

  public OutboxDelivery(
      OutboxRepository outbox,
      KafkaDelivery kafka,
      ObjectMapper mapper,
      DayfeelProperties properties) {
    this.outbox = outbox;
    this.kafka = kafka;
    this.mapper = mapper;
    topic = properties.events().outboundTopic();
  }

  @Transactional
  public void deliver(UUID id) {
    var event = outbox.lockById(id).orElseThrow();
    if (event.isPublished()) return;
    try {
      Map<String, Object> payload =
          mapper.readValue(event.getPayload(), new TypeReference<Map<String, Object>>() {});
      String body =
          mapper.writeValueAsString(
              new DomainEvent(
                  event.getId(),
                  event.getType(),
                  event.getVersion(),
                  event.getOccurredAt(),
                  payload));
      String key = String.valueOf(payload.getOrDefault("userId", event.getId().toString()));
      kafka.send(topic, key, body);
      event.setPublished(true);
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalStateException("Invalid outbox event");
    }
  }
}
