package com.dayfeel.identity;

import com.dayfeel.identity.config.DayfeelProperties;
import java.time.Duration;

public final class TestProperties {
  public static DayfeelProperties create() {
    return new DayfeelProperties(
        new DayfeelProperties.Jwt(
            "dayfeel-identity",
            "dayfeel",
            Duration.ofMinutes(15),
            Duration.ofDays(30),
            "",
            "",
            "test",
            true),
        new DayfeelProperties.Storage("local", "dayfeel-private", "us-east-1", ""),
        new DayfeelProperties.Events(
            "log", "identity-events", "content-events", "dayfeel-identity"),
        "test-internal");
  }
}
