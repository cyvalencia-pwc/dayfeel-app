package com.dayfeel.identity.profile;

import com.dayfeel.identity.config.DayfeelProperties;
import java.time.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Service
@ConditionalOnProperty(name = "dayfeel.storage.mode", havingValue = "s3")
public class S3StorageService implements StorageService {
  private final S3Presigner presigner;
  private final String bucket;
  private final Clock clock;

  public S3StorageService(S3Presigner presigner, DayfeelProperties properties, Clock clock) {
    this.presigner = presigner;
    this.bucket = properties.storage().bucket();
    this.clock = clock;
  }

  public Upload avatarUpload(String key, String type, long size) {
    var request =
        PutObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .contentType(type)
            .contentLength(size)
            .serverSideEncryption(ServerSideEncryption.AES256)
            .build();
    var signed =
        presigner.presignPutObject(
            p -> p.signatureDuration(Duration.ofMinutes(5)).putObjectRequest(request));
    return new Upload(
        key,
        signed.url().toString(),
        clock.instant().plusSeconds(300),
        true,
        java.util.Map.of("Content-Type", type, "x-amz-server-side-encryption", "AES256"));
  }

  public String download(String key) {
    return presigner
        .presignGetObject(
            p ->
                p.signatureDuration(Duration.ofMinutes(5))
                    .getObjectRequest(GetObjectRequest.builder().bucket(bucket).key(key).build()))
        .url()
        .toString();
  }
}
