package com.dayfeel.identity.auth;

import com.dayfeel.identity.config.DayfeelProperties;
import io.jsonwebtoken.*;
import java.math.BigInteger;
import java.time.Clock;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
  private final RsaKeys keys;
  private final DayfeelProperties.Jwt settings;
  private final Clock clock;

  public JwtService(RsaKeys keys, DayfeelProperties properties, Clock clock) {
    this.keys = keys;
    this.settings = properties.jwt();
    this.clock = clock;
  }

  public String issue(User user) {
    return Jwts.builder()
        .header()
        .keyId(settings.keyId())
        .and()
        .issuer(settings.issuer())
        .audience()
        .add(settings.audience())
        .and()
        .subject(user.getId().toString())
        .claim("ver", user.getTokenVersion())
        .issuedAt(Date.from(clock.instant()))
        .expiration(Date.from(clock.instant().plus(settings.accessTtl())))
        .id(UUID.randomUUID().toString())
        .signWith(keys.privateKey(), Jwts.SIG.RS256)
        .compact();
  }

  public Claims verify(String token) {
    var result =
        Jwts.parser()
            .verifyWith(keys.publicKey())
            .requireIssuer(settings.issuer())
            .requireAudience(settings.audience())
            .clock(() -> Date.from(clock.instant()))
            .build()
            .parseSignedClaims(token);
    if (!"RS256".equals(result.getHeader().getAlgorithm())
        || !settings.keyId().equals(result.getHeader().getKeyId()))
      throw new JwtException("Unsupported signing key");
    if (result.getPayload().getExpiration() == null
        || result.getPayload().getSubject() == null
        || result.getPayload().get("ver", Long.class) == null)
      throw new JwtException("Missing claims");
    if (!result.getPayload().getExpiration().toInstant().isAfter(clock.instant()))
      throw new JwtException("Token expired");
    return result.getPayload();
  }

  public Map<String, Object> jwks() {
    return Map.of(
        "keys",
        List.of(
            Map.of(
                "kty",
                "RSA",
                "use",
                "sig",
                "alg",
                "RS256",
                "kid",
                settings.keyId(),
                "n",
                unsigned(keys.publicKey().getModulus()),
                "e",
                unsigned(keys.publicKey().getPublicExponent()))));
  }

  private String unsigned(BigInteger value) {
    byte[] b = value.toByteArray();
    if (b[0] == 0) b = Arrays.copyOfRange(b, 1, b.length);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
  }
}
