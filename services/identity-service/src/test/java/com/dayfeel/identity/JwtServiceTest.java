package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;

import com.dayfeel.identity.auth.*;
import io.jsonwebtoken.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class JwtServiceTest {
  static final RsaKeys keys = new RsaKeys(TestProperties.create());
  final TestClock clock = new TestClock();
  final JwtService jwt = new JwtService(keys, TestProperties.create(), clock);
  final User user = new User(UUID.randomUUID(), "a@example.com", "hash", "alias", clock.instant());

  @Test
  void roundTrip() {
    var claims = jwt.verify(jwt.issue(user));
    assertThat(claims.getSubject()).isEqualTo(user.getId().toString());
    assertThat(claims.getIssuer()).isEqualTo("dayfeel-identity");
    assertThat(claims).doesNotContainKeys("email", "alias", "password");
  }

  @Test
  void includesVersion() {
    user.setTokenVersion(5);
    assertThat(jwt.verify(jwt.issue(user)).get("ver", Long.class)).isEqualTo(5);
  }

  @ParameterizedTest
  @ValueSource(longs = {900, 901, 3600})
  void expires(long seconds) {
    String token = jwt.issue(user);
    clock.advance(Duration.ofSeconds(seconds));
    assertThatThrownBy(() -> jwt.verify(token)).isInstanceOf(JwtException.class);
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "garbage", "a.b.c"})
  void rejectsMalformed(String token) {
    assertThatThrownBy(() -> jwt.verify(token))
        .isInstanceOfAny(JwtException.class, IllegalArgumentException.class);
  }

  @Test
  void rejectsWrongIssuer() {
    String token =
        Jwts.builder().issuer("other").signWith(keys.privateKey(), Jwts.SIG.RS256).compact();
    assertThatThrownBy(() -> jwt.verify(token)).isInstanceOf(JwtException.class);
  }

  @Test
  void rejectsWrongSignature() {
    var other =
        new JwtService(new RsaKeys(TestProperties.create()), TestProperties.create(), clock);
    assertThatThrownBy(() -> jwt.verify(other.issue(user))).isInstanceOf(JwtException.class);
  }

  @Test
  void jwksNeverContainsPrivateKey() {
    String json = jwt.jwks().toString();
    assertThat(json)
        .contains("RS256", "RSA", "kid=")
        .doesNotContain("private", " d=", " p=", " q=");
  }

  @Test
  void secretsAreRandomAndHashed() {
    var s = new TokenSecrets();
    assertThat(s.create()).hasSize(64).isNotEqualTo(s.create());
    assertThat(s.hash("abc"))
        .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  }
}
