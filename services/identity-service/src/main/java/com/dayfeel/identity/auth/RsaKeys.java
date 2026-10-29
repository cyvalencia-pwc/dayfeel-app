package com.dayfeel.identity.auth;

import com.dayfeel.identity.config.DayfeelProperties;
import java.nio.file.*;
import java.security.*;
import java.security.interfaces.*;
import java.security.spec.*;
import java.util.Base64;
import org.springframework.stereotype.Component;

@Component
public class RsaKeys {
  private final KeyPair pair;

  public RsaKeys(DayfeelProperties properties) {
    var p = properties.jwt();
    try {
      if (p.privateKey().isBlank() || p.publicKey().isBlank()) {
        if (!p.ephemeralKeys())
          throw new IllegalStateException(
              "Configure RSA keys or explicitly enable local ephemeral keys");
        var generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(3072);
        pair = generator.generateKeyPair();
      } else {
        var factory = KeyFactory.getInstance("RSA");
        var privateKey = factory.generatePrivate(new PKCS8EncodedKeySpec(read(p.privateKey())));
        var publicKey = factory.generatePublic(new X509EncodedKeySpec(read(p.publicKey())));
        if (!((RSAPrivateKey) privateKey)
            .getModulus()
            .equals(((RSAPublicKey) publicKey).getModulus()))
          throw new IllegalStateException("RSA key pair does not match");
        pair = new KeyPair(publicKey, privateKey);
      }
      if (publicKey().getModulus().bitLength() < 2048)
        throw new IllegalStateException("RSA key must be at least 2048 bits");
    } catch (java.io.IOException | GeneralSecurityException e) {
      throw new IllegalStateException("Cannot load RSA keys");
    }
  }

  private byte[] read(String path) throws java.io.IOException {
    return Base64.getMimeDecoder()
        .decode(Files.readString(Path.of(path)).replaceAll("-----[^-]+-----", ""));
  }

  public RSAPublicKey publicKey() {
    return (RSAPublicKey) pair.getPublic();
  }

  public PrivateKey privateKey() {
    return pair.getPrivate();
  }
}
