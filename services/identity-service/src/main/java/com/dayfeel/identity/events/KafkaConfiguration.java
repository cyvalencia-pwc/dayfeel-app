package com.dayfeel.identity.events;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.context.annotation.*;
import org.springframework.kafka.KafkaException;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.*;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
@ConditionalOnProperty(name = "dayfeel.events.mode", havingValue = "kafka")
public class KafkaConfiguration {
  @Bean
  public DefaultErrorHandler kafkaErrorHandler(KafkaDelivery delivery) {
    var handler =
        new DefaultErrorHandler(
            (record, error) ->
                delivery.send(
                    record.topic() + ".DLT",
                    record.key() == null ? null : record.key().toString(),
                    (String) record.value()),
            new FixedBackOff(1000L, 2L));
    // All failures receive the same bounded retry policy, including malformed JSON.
    handler.setClassifications(java.util.Map.of(), true);
    handler.setSeekAfterError(false);
    handler.setResetStateOnExceptionChange(false);
    handler.setLogLevel(KafkaException.Level.DEBUG);
    return handler;
  }

  @Bean
  public ConcurrentKafkaListenerContainerFactory<String, String>
      identityKafkaListenerContainerFactory(
          KafkaProperties properties, DefaultErrorHandler kafkaErrorHandler) {
    var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
    factory.setConsumerFactory(
        new DefaultKafkaConsumerFactory<>(properties.buildConsumerProperties(null)));
    factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.RECORD);
    factory.setCommonErrorHandler(kafkaErrorHandler);
    factory.setMissingTopicsFatal(true);
    return factory;
  }
}
