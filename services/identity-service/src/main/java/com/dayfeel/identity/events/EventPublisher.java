package com.dayfeel.identity.events;

public interface EventPublisher {
  void publish(DomainEvent event);
}
