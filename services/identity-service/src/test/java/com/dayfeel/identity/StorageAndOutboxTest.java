package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dayfeel.identity.common.*;
import com.dayfeel.identity.events.*;
import com.dayfeel.identity.profile.*;
import java.net.URL;
import java.util.*;
import java.util.function.Consumer;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.*;

@ExtendWith(MockitoExtension.class)
class StorageAndOutboxTest {
  @Mock S3Presigner presigner;
  @Mock OutboxRepository outbox;
  @Mock OutboxDelivery delivery;
  @Mock AuditLog audit;
  final TestClock clock = new TestClock();

  @Test
  void s3UploadSignsTypeSizeAndExpiry() throws Exception {
    var signed = mock(PresignedPutObjectRequest.class);
    when(signed.url()).thenReturn(new URL("https://example.org/upload"));
    when(presigner.presignPutObject(
            ArgumentMatchers.<Consumer<PutObjectPresignRequest.Builder>>any()))
        .thenAnswer(
            i -> {
              var b = PutObjectPresignRequest.builder();
              i.<Consumer<PutObjectPresignRequest.Builder>>getArgument(0).accept(b);
              var request = b.build();
              assertThat(request.signatureDuration()).isEqualTo(java.time.Duration.ofMinutes(5));
              assertThat(request.putObjectRequest().contentLength()).isEqualTo(42);
              assertThat(request.putObjectRequest().contentType()).isEqualTo("image/png");
              return signed;
            });
    var result =
        new S3StorageService(presigner, TestProperties.create(), clock)
            .avatarUpload("avatars/u/x", "image/png", 42);
    assertThat(result.requiredHeaders())
        .containsEntry("Content-Type", "image/png")
        .containsEntry("x-amz-server-side-encryption", "AES256");
  }

  @Test
  void outboxContinuesAfterOneFailure() {
    var a =
        new OutboxEvent(
            new DomainEvent(UUID.randomUUID(), "A", 1, clock.instant(), Map.of()), "{}");
    var b =
        new OutboxEvent(
            new DomainEvent(UUID.randomUUID(), "B", 1, clock.instant(), Map.of()), "{}");
    when(outbox.findTop50ByPublishedFalseOrderByOccurredAtAsc()).thenReturn(List.of(a, b));
    doThrow(new IllegalStateException()).when(delivery).deliver(a.getId());
    new OutboxJob(outbox, delivery, audit).run();
    verify(delivery).deliver(b.getId());
    verify(audit).record(AuditLog.Action.EVENT_FAILED, null);
  }
}
