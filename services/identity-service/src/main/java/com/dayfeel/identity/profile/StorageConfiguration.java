package com.dayfeel.identity.profile;

import com.dayfeel.identity.config.DayfeelProperties;
import java.net.URI;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class StorageConfiguration {
  @Bean
  @ConditionalOnProperty(name = "dayfeel.storage.mode", havingValue = "s3")
  S3Presigner presigner(DayfeelProperties p) {
    var builder = S3Presigner.builder().region(Region.of(p.storage().region()));
    if (!p.storage().endpoint().isBlank())
      builder
          .endpointOverride(URI.create(p.storage().endpoint()))
          .serviceConfiguration(
              software.amazon.awssdk.services.s3.S3Configuration.builder()
                  .pathStyleAccessEnabled(true)
                  .build());
    return builder.build();
  }
}
