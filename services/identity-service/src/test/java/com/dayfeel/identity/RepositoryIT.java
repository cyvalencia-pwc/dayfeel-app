package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.community.*;
import com.dayfeel.identity.events.*;
import com.dayfeel.identity.privacy.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.*;

@Tag("integration")
@Testcontainers
@DataJpaTest(properties = {"spring.jpa.hibernate.ddl-auto=none", "spring.flyway.enabled=true"})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class RepositoryIT {
  @Container
  static final MySQLContainer<?> MYSQL =
      new MySQLContainer<>("mysql:8.0").withDatabaseName("dayfeel_identity");

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", MYSQL::getJdbcUrl);
    r.add("spring.datasource.username", MYSQL::getUsername);
    r.add("spring.datasource.password", MYSQL::getPassword);
  }

  @Autowired UserRepository users;
  @Autowired RoleRepository roles;
  @Autowired RefreshTokenRepository tokens;
  @Autowired CircleRepository circles;
  @Autowired MembershipRepository members;
  @Autowired PrivacyRequestRepository privacy;
  @Autowired ProcessedEventRepository processed;
  @Autowired OutboxRepository outbox;
  @Autowired JdbcTemplate jdbc;
  @Autowired TestEntityManager em;
  final Instant now = Instant.parse("2026-01-01T00:00:00Z");

  User user() {
    var u =
        new User(
            UUID.randomUUID(),
            UUID.randomUUID() + "@example.com",
            "hash",
            "Otter" + UUID.randomUUID(),
            now);
    u.getRoles().add(roles.findById("USER").orElseThrow());
    return users.saveAndFlush(u);
  }

  @Test
  void bothMigrationsApplied() {
    assertThat(
            jdbc.queryForObject(
                "select count(*) from flyway_schema_history where success=1", Integer.class))
        .isEqualTo(2);
  }

  @Test
  void schemaUsesVarcharNotMysqlEnum() {
    assertThat(
            jdbc.queryForObject(
                "select count(*) from information_schema.columns where table_schema=database() and data_type='enum'",
                Integer.class))
        .isZero();
  }


  @Test
  void userQueriesAndRoleMapping() {
    var u = user();
    em.clear();
    assertThat(users.lockById(u.getId())).isPresent();
    assertThat(users.lockByEmail(u.getEmail())).isPresent();
    assertThat(users.findByEmail(u.getEmail()).orElseThrow().hasRole("USER")).isTrue();
    assertThat(users.existsByAlias(u.getAlias())).isTrue();
  }

  @Test
  void refreshOwnerLockAndRevocation() {
    var u = user();
    var t = new RefreshToken("a".repeat(64), u.getId(), now.plusSeconds(60));
    tokens.saveAndFlush(t);
    assertThat(tokens.ownerOf(t.getHash())).contains(u.getId());
    assertThat(tokens.findById(t.getHash())).isPresent();
    assertThat(tokens.revokeAll(u.getId())).isEqualTo(1);
    em.clear();
    assertThat(tokens.findById(t.getHash()).orElseThrow().isRevoked()).isTrue();
  }

  @Test
  void circleAndMembershipLocks() {
    var u = user();
    var c = circles.saveAndFlush(new Circle(UUID.randomUUID(), "circle", u.getId()));
    members.saveAndFlush(new Membership(c.getId(), u.getId(), Membership.MemberRole.OWNER));
    assertThat(circles.lockById(c.getId())).isPresent();
    assertThat(members.lockMember(c.getId(), u.getId())).isPresent();
    assertThat(members.findByCircleIdAndUserId(c.getId(), u.getId())).isPresent();
  }

  @Test
  void expiryQueriesOnlyLiftExpiredRestrictions() {
    var u = user();
    var c = circles.saveAndFlush(new Circle(UUID.randomUUID(), "circle", u.getId()));
    var m = new Membership(c.getId(), u.getId(), Membership.MemberRole.MEMBER);
    m.setMutedUntil(now);
    m.setBannedUntil(now.plusSeconds(60));
    members.saveAndFlush(m);
    assertThat(members.liftMutes(now)).isEqualTo(1);
    assertThat(members.liftBans(now)).isZero();
    em.clear();
    var actual = members.findByCircleIdAndUserId(c.getId(), u.getId()).orElseThrow();
    assertThat(actual.getMutedUntil()).isNull();
    assertThat(actual.getBannedUntil()).isEqualTo(now.plusSeconds(60));
  }

  @Test
  void privacyPendingQueryAndLock() {
    var u = user();
    var r = privacy.saveAndFlush(new PrivacyRequest(u.getId(), PrivacyRequest.Kind.EXPORT, now));
    assertThat(privacy.lockById(r.getId())).isPresent();
    assertThat(
            privacy.findFirstByUserIdAndKindAndStatusOrderByCreatedAtDesc(
                u.getId(), r.getKind(), PrivacyRequest.Status.PENDING))
        .isPresent();
  }

  @Test
  void eventClaimIsIdempotent() {
    String id = UUID.randomUUID().toString();
    assertThat(processed.claim(id, now)).isEqualTo(1);
    assertThat(processed.claim(id, now)).isZero();
  }

  @Test
  void outboxQueryAndLock() {
    var e =
        outbox.saveAndFlush(
            new OutboxEvent(new DomainEvent(UUID.randomUUID(), "Test", 1, now, Map.of()), "{}"));
    assertThat(outbox.findTop50ByPublishedFalseOrderByOccurredAtAsc())
        .extracting(OutboxEvent::getId)
        .contains(e.getId());
    assertThat(outbox.lockById(e.getId())).isPresent();
  }


  @Test
  void userDeletionCascadesAndPreservesCircle() {
    var u = user();
    tokens.saveAndFlush(new RefreshToken("b".repeat(64), u.getId(), now.plusSeconds(60)));
    var c = circles.saveAndFlush(new Circle(UUID.randomUUID(), "circle", u.getId()));
    members.saveAndFlush(new Membership(c.getId(), u.getId(), Membership.MemberRole.OWNER));
    users.delete(u);
    users.flush();
    em.clear();
    assertThat(tokens.ownerOf("b".repeat(64))).isEmpty();
    assertThat(members.findByCircleIdAndUserId(c.getId(), u.getId())).isEmpty();
    assertThat(circles.findById(c.getId()).orElseThrow().getOwnerId()).isNull();
  }

  @Test
  void exportQueriesAreScopedToUser() {
    var u = user();
    var c = circles.saveAndFlush(new Circle(UUID.randomUUID(), "owned", u.getId()));
    members.saveAndFlush(new Membership(c.getId(), u.getId(), Membership.MemberRole.OWNER));
    privacy.saveAndFlush(new PrivacyRequest(u.getId(), PrivacyRequest.Kind.EXPORT, now));
    assertThat(circles.findByOwnerId(u.getId())).hasSize(1);
    assertThat(members.findByUserId(u.getId())).hasSize(1);
    assertThat(privacy.findByUserId(u.getId())).hasSize(1);
    assertThat(circles.findByOwnerId(UUID.randomUUID())).isEmpty();
  }
}
