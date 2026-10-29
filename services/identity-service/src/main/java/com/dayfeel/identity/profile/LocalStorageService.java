package com.dayfeel.identity.profile;

import java.time.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "dayfeel.storage.mode", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {
  private final Clock clock;

  public LocalStorageService(Clock clock) {
    this.clock = clock;
  }

  public Upload avatarUpload(String key, String type, long size) {
    return new Upload(key, "", clock.instant().plusSeconds(300), false);
  }

  public String download(String key) {
    return "";
  }
}
