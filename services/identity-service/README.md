# DayFeel identity-service
Java 21 / Spring Boot 3.3.13 / Maven. Package and group: com.dayfeel.identity / com.dayfeel.
Port 8081; database dayfeel_identity; JWT issuer dayfeel-identity.

DayFeel supports wellbeing and self-reflection. It does not diagnose, treat, or replace professional care.

## Run
Install JDK 21, Maven 3.9+, and Docker with Compose v2. From the monorepo root:
```powershell
Copy-Item .env.example .env
docker compose --env-file .env -f infra/docker-compose.yml up -d mysql mongodb localstack localstack-init kafka kafka-init
```
The MySQL database must be dayfeel_identity. On an existing Phase 0 volume,
changing MYSQL_DATABASE does not create a new database: create dayfeel_identity
and grant the dayfeel user access using your database administrator. Do not delete
existing volumes just to change the database name.

From services/identity-service, set environment variables (a .env file is not
automatically loaded by Spring):
```powershell
$env:JAVA_HOME = "C:\path\to\jdk-21"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$env:DB_PASSWORD = "dayfeel-local-only"
$env:JWT_EPHEMERAL_KEYS = "true"
$env:INTERNAL_KEY = "replace-with-a-long-random-local-secret"
mvn spring-boot:run
```
Use http/requests.http for requests. Health: GET /actuator/health.
Ephemeral keys are opt-in for development and invalidate tokens after restart.
Production must mount matching RSA keys: unencrypted PKCS8 private PEM and X509
public PEM, minimum 2048 bits; configure their file paths and disable ephemeral keys.
The running process needs read access; never commit private keys.
Only the gateway should be publicly accessible. It must never route /internal/**.

## Tests and formatting
```text
mvn -q test
mvn -q verify
mvn -q spotless:check
mvn -q spotless:apply
docker build -t dayfeel-identity .
```
Unit tests have no Spring context or database. They use explicit constructors,
strict Mockito stubs and a movable TestClock. MySQL 8.0 integration tests use
Testcontainers, @Tag("integration") and Failsafe. mvn test excludes them;
mvn verify includes them and fails, rather than silently skipping, without Docker.
Flyway owns the schema; ddl-auto=none. V1 defines VARCHAR status/role fields;
V2 adds processed_events and the outbox index.

If Maven on Windows encounters a corporate certificate-chain error, use your
organization's trusted Java configuration. The local validation used:
```powershell
$env:MAVEN_OPTS = "-Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE"
```
TLS verification remains enabled. This setting is not required on every machine.

## Configuration
| Property / environment | Default / purpose |
| --- | --- |
| server.port / SERVER_PORT | 8081 |
| DB_URL | jdbc:mysql://localhost:3306/dayfeel_identity |
| DB_USER / DB_PASSWORD | dayfeel / no password default |
| dayfeel.internal-key / INTERNAL_KEY | Blank: reject all internal requests |
| dayfeel.jwt.issuer | dayfeel-identity |
| dayfeel.jwt.audience | dayfeel |
| dayfeel.jwt.access-ttl | PT15M |
| dayfeel.jwt.refresh-ttl | P30D |
| dayfeel.jwt.key-id | identity-1 |
| JWT_PRIVATE_KEY / JWT_PUBLIC_KEY | PEM file paths |
| JWT_EPHEMERAL_KEYS | false |
| dayfeel.storage.mode / STORAGE_MODE | local or s3 |
| dayfeel.storage.bucket | dayfeel-private |
| dayfeel.storage.region | us-east-1 |
| dayfeel.storage.endpoint | AWS_ENDPOINT_URL or standard AWS |
| dayfeel.events.mode / EVENTS_MODE | log or kafka; default log |
| spring.kafka.bootstrap-servers / KAFKA_BOOTSTRAP_SERVERS | localhost:9092 (host); kafka:29092 (Compose) |
| dayfeel.events.group-id | dayfeel-identity |
| dayfeel.events.outbound-topic | identity-events |
| dayfeel.events.inbound-topic | content-events |
| dayfeel.events.outbox-delay-ms | 1000 |
| dayfeel.restriction-sweep-ms | 60000 |

AWS SDK v2 uses its standard credential provider chain. LocalStack uses dummy
AWS_ACCESS_KEY_ID=test and AWS_SECRET_ACCESS_KEY=test. Production uses an IAM role
with least-privilege S3 permissions. Local storage returns uploadSupported=false
and no URL; it does not pretend to store images. S3 mode signs PUTs for five minutes
and returns requiredHeaders; upload exactly the declared content type and byte size.
Browser clients must follow S3 CORS configuration. Avatar content validation/resizing
and cleanup of replaced objects belong in the subsequent media/content implementation.

## HTTP endpoints
The complete contract is ../../docs/openapi/identity-service.yaml.
JSON uses camelCase and UTC timestamps; all errors have
{ timestamp, status, code, message, path, traceId }. Unexpected errors never expose
exception messages. Unknown input properties are rejected.

| Area | Endpoints |
| --- | --- |
| Auth | POST /auth/register, /auth/login, /auth/refresh, /auth/logout |
| Keys | GET /.well-known/jwks.json |
| Profile | GET/PATCH /me; GET/PUT /me/consent; POST /me/avatar-upload |
| Frontend session | GET /me/session; POST /me/onboarding with acknowledged=true |
| Circles | GET/POST /circles; POST/DELETE /circles/{circle}/members/me |
| Circle moderators | PUT /circles/{circle}/moderators/{target} |
| Reports/moderation | POST /reports; POST /circles/{circle}/moderation |
| Moderator report reads | GET /circles/{circle}/reports?page=0; GET /reports/{report} |
| Privacy | POST /me/exports, /me/deletion; GET /me/privacy-requests/{id} |
| Directory | GET /crisis-resources?region=SG |
| Admin directory | POST /admin/crisis-resources; PUT/DELETE /admin/crisis-resources/{id} |
| Internal restrictions/membership | GET /internal/circles/{circle}/users/{user}/restrictions or /membership |
| Internal consent | GET /internal/users/{user}/consent |
| Internal aliases/reports | POST /internal/aliases, /internal/auto-reports |
| Internal export data | GET /internal/users/{user}/export-data |
| Internal callbacks | POST /internal/exports/completed, /internal/deletions/completed |

Auth/JWKS/directory/health are public. Other public routes require Bearer JWT;
admin directory writes require ADMIN. Internal routes require X-Internal-Key.
Internal alias responses contain IDs solely for backend mapping; never relay them
directly to community clients. Community responses expose circle/content identifiers,
aliases and roles, not user IDs or email. Circles use bounded page/size listing;
future content feeds use cursor pagination.

Registration creates USER only. Provision the initial ADMIN role through a controlled
database migration/operations process; there is no public role-escalation endpoint.
Phase 7 session responses expose server-derived global roles and persistent
onboarding status, without adding user identifiers to public profile responses.
Flyway V3 adds the onboarding flag and a report-list index; existing accounts
start with onboarding incomplete. Report reads authorize the requesting reviewer
in the report's circle; ordinary members cannot read the queue or report details.
Circle owners may appoint circle moderators. Global MODERATOR/ADMIN can moderate
any circle, but no one may moderate themselves, a circle owner or an ADMIN.
Restrictions are circle-scoped. Mutes/bans require an expiry within one year.
Restricted members cannot leave or rejoin; inactive memberships retain restrictions.
Expiry is enforced at read time as well as by the scheduled cleanup.

## Authentication and privacy semantics
Passwords use BCrypt; registration accepts 12Ã¢â‚¬â€œ72 characters with a 72 UTF-8 byte
ceiling. Five consecutive failed logins lock an account for 15 minutes; failures
and lock expiry use an injected Clock. Lockout writes commit on authentication failure.

Refresh tokens are 48 random bytes, stored only as SHA-256 hashes. Rotation locks
the user and token; consumed/revoked-token reuse revokes every refresh token and
increments the access-token version. Logout also ends all sessions. Access JWTs
are explicitly RS256 and checked for issuer, audience, expiry, key ID, account
status and current token version. Retain consumed hashes for the reuse-detection
window; a production retention job and multi-key JWKS rollover remain operational
follow-up work.

All consent flags default OFF. Journal, chat and companion text are not owned by
this service and are never accepted by its defined DTOs or logged. Reports contain
category and references only. Logs contain trace IDs and fixed audit identifiers.

Deletion marks PENDING_DELETION, revokes tokens and publishes UserDeletionRequested.
Only the correlated content-service confirmation hard-deletes identity data; foreign
keys cascade dependent credentials and detach retained circles/audit records.
Export creates a request; content-service assembles and uploads the archive, then
returns an object key matching exports/{requestId}/{name}.zip. Download URLs are
short-lived and issued only after owner authorization. Neither workflow can finish
end-to-end until content-service is implemented. Log mode does not deliver events.

## Events and reliability
Envelope: { id, type, version, occurredAt, payload }. Version is 1.
Outgoing: ConsentChanged, ModerationActionCreated, DataExportRequested,
UserDeletionRequested. Incoming: DataExportCompleted and UserDeletionCompleted.
Completion payloads require requestId and userId; exports also require objectKey.
Unsupported types, versions and fields fail processing.

Kafka mode persists an outbox row in the business transaction. Sends use broker
acks=all and idempotent producers; the dispatcher marks published only after the
send future succeeds. A crash after acknowledgment can redeliver the same event ID;
processed_events still deduplicates database effects. Records use userId as their
partition key when available, otherwise the event ID. This does not guarantee
business commit ordering across multiple outbox dispatchers.

The content-events consumer disables auto-commit and uses RECORD acknowledgment.
The transactional completion handler returns only after committing its database
work. Failures get two retries, then the original record is sent to content-events.DLT.
Recovery succeeds only after the DLT send is acknowledged; a failed DLT send leaves
the source record uncommitted and retries recovery. Crashes/rebalances can reset
in-memory retry counts, so three attempts is a per-consumer processing cycle limit.
Framework listener/body error logging is disabled to protect submitted data; monitor
consumer lag, outbox backlog and DLT topics. Restrict DLT access and replay after repair.

Local setup:
```powershell
$env:EVENTS_MODE = "kafka"
$env:KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
mvn spring-boot:run
```
For Compose, set EVENTS_MODE=kafka in the root .env and run:
```powershell
docker compose --env-file .env -f infra/docker-compose.yml --profile identity up -d --build
```
Run that Compose command from the repository root. Kafka is provisioned by
infra/kafka/init-topics.sh: identity-events, content-events, dayfeel-analysis,
dayfeel-events and corresponding .DLT topics. LocalStack provisions S3 only.
Local Kafka is single-node PLAINTEXT for development. Production needs replicated
topics, suitable min.insync.replicas, TLS/SASL, ACLs, retention and monitoring.
Configure security via standard spring.kafka properties; credentials are not logged.
Log mode remains the default and does not contact a broker or deliver events.
AWS_ENDPOINT_URL now affects S3 only; event endpoint/region/queue properties were removed.
No database migration is necessary: existing outbox rows retain their envelope and IDs.
Before migrating an existing environment, drain/reconcile the old transport backlog;
already-published database rows are not automatically replayed into Kafka.

## Tests and validation
Unit tests: mvn -q test. All integrations: mvn -q verify (MySQL requires Docker).
Kafka-only integration: mvn -q -Dit.test=KafkaBrokerIT verify. The latter uses an
embedded KRaft broker and no Spring application context or Docker.
See [Kafka migration validation](../../docs/kafka-migration.md) for actual results.

References: [Kafka Docker image](https://kafka.apache.org/37/getting-started/docker/),
[Spring Kafka error handling](https://docs.spring.io/spring-kafka/reference/kafka/annotation-error-handling.html).

## Swagger UI

After rebuilding and restarting this service, open http://localhost:8081/docs.
The OpenAPI JSON is at http://localhost:8081/swagger-ui/openapi.json. The documentation is
public; executing protected operations still requires normal authorization.
Use identity POST /auth/login to obtain an accessToken, click Authorize, and
paste the token into bearerAuth without the Bearer prefix. Internal operations
require the configured X-Internal-Key as specified by their security scheme.
Credentials are not persisted by Swagger UI. Try it out executes real requests.

The UI loads pinned Swagger UI assets from jsDelivr and requires browser internet
access. The API contract itself is bundled in the application and Docker image.
Documentation uses the checked-in contract, not automatic controller inference.
After changing docs/openapi, run from the repository root:

```bat
node scripts/sync-swagger.cjs
node scripts/sync-swagger.cjs --check
```

Then rebuild the affected service. The served contract uses the current server
origin so Try it out targets the service you opened. Open the direct service
URL above rather than the Vite API proxy for documentation.
