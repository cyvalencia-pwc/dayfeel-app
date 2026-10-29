package com.dayfeel.identity.auth;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class TokenSecrets {
  private final SecureRandom random = new SecureRandom();

  public String create() {
    byte[] bytes = new byte[48];
    random.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  public String hash(String raw) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 unavailable");
    }
  }
}
