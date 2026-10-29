package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dayfeel.identity.events.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.concurrent.*;
import org.apache.kafka.clients.consumer.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.MessageListenerContainer;

@ExtendWith(MockitoExtension.class)
class KafkaEventsTest {
  @Mock OutboxRepository outbox;
  @Mock KafkaDelivery delivery;
  @Mock KafkaTemplate<String, String> template;
  @Mock ContentEventHandler handler;
  @Mock Consumer<String, String> consumer;
  @Mock MessageListenerContainer container;
  final TestClock clock = new TestClock();
  final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

  DomainEvent event() {
    return new DomainEvent(
        UUID.randomUUID(),
        "UserDeletionCompleted",
        1,
        clock.instant(),
        Map.of("requestId", UUID.randomUUID(), "userId", UUID.randomUUID()));
  }

  @Test
  void publisherPersistsOutbox() {
    var event = event();
    new KafkaEventPublisher(outbox, mapper).publish(event);
    verify(outbox).save(argThat(e -> e.getId().equals(event.id()) && !e.isPublished()));
  }

  @Test
  void logModeDoesNotContactKafka() {
    new LogEventPublisher().publish(event());
    verifyNoInteractions(template);
  }

  @Test
  void completedOutboxSkipped() {
    var e = new OutboxEvent(event(), "{}");
    e.setPublished(true);
    when(outbox.lockById(e.getId())).thenReturn(Optional.of(e));
    new OutboxDelivery(outbox, delivery, mapper, TestProperties.create()).deliver(e.getId());
    verifyNoInteractions(delivery);
  }

  @Test
  void confirmedDeliveryMarksPublished() throws Exception {
    var event = event();
    var e = new OutboxEvent(event, mapper.writeValueAsString(event.payload()));
    when(outbox.lockById(e.getId())).thenReturn(Optional.of(e));
    new OutboxDelivery(outbox, delivery, mapper, TestProperties.create()).deliver(e.getId());
    assertThat(e.isPublished()).isTrue();
    verify(delivery)
        .send(
            eq("identity-events"),
            eq(event.payload().get("userId").toString()),
            argThat(body -> body.contains(event.id().toString())));
  }

  @Test
  void failureKeepsPending() {
    var e = new OutboxEvent(event(), "{}");
    when(outbox.lockById(e.getId())).thenReturn(Optional.of(e));
    doThrow(new IllegalStateException()).when(delivery).send(any(), any(), any());
    assertThatThrownBy(
            () ->
                new OutboxDelivery(outbox, delivery, mapper, TestProperties.create())
                    .deliver(e.getId()))
        .isInstanceOf(IllegalStateException.class);
    assertThat(e.isPublished()).isFalse();
  }

  @Test
  void waitsForBrokerAcknowledgement() {
    when(template.send("topic", "key", "body")).thenReturn(CompletableFuture.completedFuture(null));
    new KafkaDelivery(template).send("topic", "key", "body");
    verify(template).send("topic", "key", "body");
  }

  @Test
  void asynchronousFailurePropagates() {
    when(template.send("topic", "key", "body"))
        .thenReturn(CompletableFuture.failedFuture(new IllegalStateException("secret")));
    assertThatThrownBy(() -> new KafkaDelivery(template).send("topic", "key", "body"))
        .hasMessage("Kafka delivery was not confirmed")
        .hasNoCause();
  }

  @Test
  void timeoutDoesNotClaimSuccess() throws Exception {
    var future = mock(CompletableFuture.class);
    when(template.send("topic", "key", "body")).thenReturn(future);
    when(future.get(10, TimeUnit.SECONDS)).thenThrow(new TimeoutException());
    assertThatThrownBy(() -> new KafkaDelivery(template).send("topic", "key", "body"))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void interruptRestored() throws Exception {
    var future = mock(CompletableFuture.class);
    when(template.send("topic", "key", "body")).thenReturn(future);
    when(future.get(10, TimeUnit.SECONDS)).thenThrow(new InterruptedException());
    try {
      assertThatThrownBy(() -> new KafkaDelivery(template).send("topic", "key", "body"))
          .isInstanceOf(IllegalStateException.class);
      assertThat(Thread.currentThread().isInterrupted()).isTrue();
    } finally {
      Thread.interrupted();
    }
  }

  @Test
  void validContentProcessed() throws Exception {
    var e = event();
    new KafkaContentListener(mapper, handler).consume(mapper.writeValueAsString(e));
    verify(handler).handle(argThat(actual -> actual.id().equals(e.id())));
  }

  @Test
  void malformedContentFailsWithoutLeaking() {
    assertThatThrownBy(() -> new KafkaContentListener(mapper, handler).consume("private text"))
        .hasMessage("Content event processing failed")
        .hasNoCause();
    verifyNoInteractions(handler);
  }

  @Test
  void handlerFailurePropagatesForRetry() throws Exception {
    doThrow(new IllegalStateException("private")).when(handler).handle(any());
    String body = mapper.writeValueAsString(event());
    assertThatThrownBy(() -> new KafkaContentListener(mapper, handler).consume(body))
        .hasMessage("Content event processing failed")
        .hasNoCause();
  }

  @Test
  void threeAttemptsBeforeDlt() {
    var errors = new KafkaConfiguration().kafkaErrorHandler(delivery);
    var record = new ConsumerRecord<>("content-events", 0, 0L, "key", "body");
    var failure = new IllegalStateException("safe");
    assertThat(errors.handleOne(failure, record, consumer, container)).isFalse();
    assertThat(errors.handleOne(failure, record, consumer, container)).isFalse();
    verifyNoInteractions(delivery);
    assertThat(errors.handleOne(failure, record, consumer, container)).isTrue();
    verify(delivery).send("content-events.DLT", "key", "body");
  }

  @Test
  void failedDltIsNotRecovered() {
    var errors = new KafkaConfiguration().kafkaErrorHandler(delivery);
    var record = new ConsumerRecord<>("content-events", 0, 0L, "key", "body");
    var failure = new IllegalStateException("safe");
    errors.handleOne(failure, record, consumer, container);
    errors.handleOne(failure, record, consumer, container);
    doThrow(new IllegalStateException()).when(delivery).send("content-events.DLT", "key", "body");
    assertThat(errors.handleOne(failure, record, consumer, container)).isFalse();
  }
}
