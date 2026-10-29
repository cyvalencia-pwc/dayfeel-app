package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.*;

import com.dayfeel.identity.events.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.*;
import org.junit.jupiter.api.*;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.MessageListener;
import org.springframework.kafka.test.EmbeddedKafkaKraftBroker;

@Tag("integration")
class KafkaBrokerIT {
  @Test
  void brokerAcknowledgementsRetriesDeadLettersAndOffsetCommits() throws Exception {
    var broker =
        new EmbeddedKafkaKraftBroker(
            1, 1, "content-events", "content-events.DLT", "identity-events");
    broker.afterPropertiesSet();
    try {
      Map<String, Object> producerProps = new HashMap<>();
      producerProps.put("bootstrap.servers", broker.getBrokersAsString());
      producerProps.put("key.serializer", StringSerializer.class);
      producerProps.put("value.serializer", StringSerializer.class);
      producerProps.put("acks", "all");
      producerProps.put("enable.idempotence", true);
      var producers = new DefaultKafkaProducerFactory<String, String>(producerProps);
      var template = new KafkaTemplate<String, String>(producers);
      var delivery = new KafkaDelivery(template);
      var properties = new KafkaProperties();
      properties.setBootstrapServers(List.of(broker.getBrokersAsString()));
      properties.getConsumer().setEnableAutoCommit(false);
      properties.getConsumer().setAutoOffsetReset("earliest");
      properties.getConsumer().setKeyDeserializer(StringDeserializer.class);
      properties.getConsumer().setValueDeserializer(StringDeserializer.class);
      String group = "identity-test-" + UUID.randomUUID();
      var configuration = new KafkaConfiguration();
      var factory =
          configuration.identityKafkaListenerContainerFactory(
              properties, configuration.kafkaErrorHandler(delivery));
      var handler = mock(ContentEventHandler.class);
      var attempts = new AtomicInteger();
      var successes = new AtomicInteger();
      UUID poisonId = UUID.randomUUID();
      doAnswer(
              inv -> {
                DomainEvent e = inv.getArgument(0);
                if (e.id().equals(poisonId)) {
                  attempts.incrementAndGet();
                  throw new IllegalStateException("simulated failure");
                }
                successes.incrementAndGet();
                return null;
              })
          .when(handler)
          .handle(any());
      var mapper = new ObjectMapper().findAndRegisterModules();
      var listener = new KafkaContentListener(mapper, handler);
      var container = factory.createContainer("content-events");
      container.getContainerProperties().setGroupId(group);
      container.setupMessageListener(
          (MessageListener<String, String>) record -> listener.consume(record.value()));
      container.start();
      try {
        Map<String, Object> payload =
            Map.of("requestId", UUID.randomUUID(), "userId", UUID.randomUUID());
        String bad =
            mapper.writeValueAsString(
                new DomainEvent(poisonId, "UserDeletionCompleted", 1, Instant.now(), payload));
        delivery.send("content-events", "user", bad);
        delivery.send(
            "content-events",
            "user",
            mapper.writeValueAsString(
                new DomainEvent(
                    UUID.randomUUID(), "UserDeletionCompleted", 1, Instant.now(), payload)));
        await()
            .atMost(Duration.ofSeconds(30))
            .untilAsserted(() -> assertThat(successes.get()).isEqualTo(1));
        assertThat(attempts.get()).isEqualTo(3);
        Map<String, Object> consumerProps = new HashMap<>();
        consumerProps.put("bootstrap.servers", broker.getBrokersAsString());
        consumerProps.put("group.id", "dlt-" + UUID.randomUUID());
        consumerProps.put("auto.offset.reset", "earliest");
        consumerProps.put("enable.auto.commit", false);
        try (var consumer =
            new KafkaConsumer<String, String>(
                consumerProps, new StringDeserializer(), new StringDeserializer())) {
          consumer.subscribe(List.of("content-events.DLT"));
          var values = new ArrayList<String>();
          await()
              .atMost(Duration.ofSeconds(20))
              .until(
                  () -> {
                    consumer.poll(Duration.ofMillis(500)).forEach(r -> values.add(r.value()));
                    return !values.isEmpty();
                  });
          assertThat(values).containsExactly(bad);
        }
        try (var admin =
            AdminClient.create(Map.of("bootstrap.servers", broker.getBrokersAsString()))) {
          await()
              .atMost(Duration.ofSeconds(10))
              .untilAsserted(
                  () -> {
                    var offsets =
                        admin.listConsumerGroupOffsets(group).partitionsToOffsetAndMetadata().get();
                    assertThat(offsets.get(new TopicPartition("content-events", 0)).offset())
                        .isEqualTo(2L);
                  });
        }
      } finally {
        container.stop();
        template.destroy();
        producers.destroy();
      }
    } finally {
      broker.destroy();
    }
  }
}
