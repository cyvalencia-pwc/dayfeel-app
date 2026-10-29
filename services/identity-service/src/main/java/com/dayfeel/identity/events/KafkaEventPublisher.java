package com.dayfeel.identity.events;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@ConditionalOnProperty(name = "dayfeel.events.mode", havingValue = "kafka")
public class KafkaEventPublisher implements EventPublisher {
  private final OutboxRepository outbox;
  private final ObjectMapper mapper;

  public KafkaEventPublisher(OutboxRepository outbox, ObjectMapper mapper) {
    this.outbox = outbox;
    this.mapper = mapper;
  }

  @Transactional
  public void publish(DomainEvent event) {
    try {
      outbox.save(new OutboxEvent(event, mapper.writeValueAsString(event.payload())));
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Cannot encode domain event");
    }
  }
}
