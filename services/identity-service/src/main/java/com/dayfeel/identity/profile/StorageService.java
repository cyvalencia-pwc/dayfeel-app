package com.dayfeel.identity.profile;

import java.time.Instant;
import java.util.Map;

public interface StorageService {
  record Upload(
      String objectKey,
      String url,
      Instant expiresAt,
      boolean uploadSupported,
      Map<String, String> requiredHeaders) {
    public Upload(String key, String url, Instant at, boolean supported) {
      this(key, url, at, supported, Map.of());
    }
  }

  Upload avatarUpload(String objectKey, String contentType, long size);

  String download(String objectKey);
}
