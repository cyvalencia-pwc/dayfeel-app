package com.dayfeel.identity.config;

import java.time.Clock;
import org.springframework.context.annotation.*;

@Configuration
public class CoreConfiguration {
  @Bean
  public Clock clock() {
    return Clock.systemUTC();
  }
}
