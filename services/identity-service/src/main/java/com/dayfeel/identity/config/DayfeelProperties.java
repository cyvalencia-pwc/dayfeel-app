package com.dayfeel.identity.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("dayfeel")
public record DayfeelProperties(
    @DefaultValue Jwt jwt,
    @DefaultValue Storage storage,
    @DefaultValue Events events,
    @DefaultValue("") String internalKey) {
  public record Jwt(
      @DefaultValue("dayfeel-identity") String issuer,
      @DefaultValue("dayfeel") String audience,
      @DefaultValue("PT15M") Duration accessTtl,
      @DefaultValue("P30D") Duration refreshTtl,
      @DefaultValue("") String privateKey,
      @DefaultValue("") String publicKey,
      @DefaultValue("identity-1") String keyId,
      @DefaultValue("false") boolean ephemeralKeys) {}

  public record Storage(
      @DefaultValue("local") String mode,
      @DefaultValue("dayfeel-private") String bucket,
      @DefaultValue("us-east-1") String region,
      @DefaultValue("") String endpoint) {}

  public record Events(
      @DefaultValue("log") String mode,
      @DefaultValue("identity-events") String outboundTopic,
      @DefaultValue("content-events") String inboundTopic,
      @DefaultValue("dayfeel-identity") String groupId) {}
}
