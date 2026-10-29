package com.dayfeel.identity.events;

import java.util.concurrent.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "dayfeel.events.mode", havingValue = "kafka")
public class KafkaDelivery {
  private final KafkaTemplate<String, String> kafka;

  public KafkaDelivery(KafkaTemplate<String, String> kafka) {
    this.kafka = kafka;
  }

  public void send(String topic, String key, String body) {
    try {
      kafka.send(topic, key, body).get(10, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Kafka delivery interrupted");
    } catch (ExecutionException | TimeoutException e) {
      throw new IllegalStateException("Kafka delivery was not confirmed");
    }
  }
}
