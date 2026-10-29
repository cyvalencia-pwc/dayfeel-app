# DayFeel content-service — Phases 2, 4 and 5

Node.js 20, TypeScript, Express, MongoDB 7/Mongoose and KafkaJS.

## Run

For Windows CMD without Docker, follow the [Phase 2 startup instructions](../../docs/start-and-test-without-docker.md#7-start-phase-2-content-service). They cover native MongoDB/Kafka, identity-service, `.env`, startup, and the first journal/mood requests. The commands below use Docker for MongoDB.

From this directory:

~~~sh
npm ci
cp .env.example .env
docker compose -f compose.mongo.yml up -d --wait
npm run build
npm start
~~~

In PowerShell, use `Copy-Item .env.example .env` instead of `cp`.
Set a real shared `INTERNAL_KEY`; match identity-service's JWT issuer,
audience and JWKS URL. Start identity-service and Kafka using the root infra
instructions and rerun the Kafka topic initializer after upgrading from Phase 1.
AI is a separately implemented service; its adapter contract is listed below.
The service listens on port 8082; the gateway is not part of this phase.

MongoDB **must support transactions** (replica set or sharded cluster).
The supplied development Compose starts an isolated single-member replica set on
loopback port 27018. It has no authentication and is for local development only.
It does not change the older standalone MongoDB in root infra.
Production needs an authenticated/TLS replica set and appropriate MongoDB/Kafka
network credentials. The app validates environment variables at startup and
initializes collection indexes before accepting traffic.

`npm run dev` watches TypeScript. `npm run build` compiles to dist.
`npm test` runs Jest, Supertest and mongodb-memory-server with real
MongoDB replica-set transactions and mocked identity/AI clients. The first test
run downloads MongoDB 7.0.14 (large on Windows); allow network access and process
execution, or set MONGOMS_SYSTEM_BINARY to an existing compatible mongod binary.
The setup hook allows ten minutes for the initial download.
`npm run format:check` checks formatting.

### Dependency security

Keep auditing enabled when installing (`npm ci` or `npm install`). Jest 30.5.2
and matching Jest types remove the old `micromatch`/`braces` dependency path.
The scoped `@istanbuljs/load-nyc-config` override uses `js-yaml` 4.3.2 or newer
within major 4, removing its old `argparse`/`sprintf-js` dependency path. This
addresses the two advisories behind the previous 34 transitive findings:
[braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and
[sprintf-js](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

`tests/tooling.test.ts` verifies YAML configuration loading and inheritance through
the actual coverage loader. Keep the scoped override until that loader updates
its own YAML dependency, then reassess it. No audit exclusions or vulnerable-package
version aliases are used. Run `npm audit --offline=false` for a fresh advisory
check; an audit endpoint timeout is not a clean report.

## HTTP contract

Phase 5 adds community posts/comments/reactions, `/chat`,
S3 files and privacy event handlers. See the [Phase 5 setup and call sequence](../../docs/phase-5.md).

Phase 4 adds companion conversations and circle chat; see the Phase 4 section below for request order and AI contracts.

See [OpenAPI](../../docs/openapi/content-service.json) for schemas and errors.
All routes except GET /health require an RS256 bearer token. JWKS keys are cached
for ten minutes and refreshed on unknown kid. Issuer, audience, subject, issued-at
and expiry are required. Identity's current tokens contain no roles; requireRole
denies access unless the required role is in a verified roles claim.
No role-protected administrative endpoints are exposed in Phase 2.

| Method | Route | Behavior |
| --- | --- | --- |
| POST | /journal | Create; returns 201 with entry, nullable support, and streak |
| GET | /journal | Owner-only list, newest first; limit 1–100, optional before timestamp |
| GET | /journal/:id | Owner-only entry |
| PUT | /journal | Full replacement fields plus id in body |
| DELETE | /journal | id in body; 204 |
| PUT / DELETE | /journal/:id | Equivalent item operations |
| PUT | /mood/today | Upsert user's local day |
| GET | /mood/summary | range=7d, 30d or 90d; inclusive dates, average, count, days and streak |
| GET | /mood/calendar | month=YYYY-MM; days recorded by this user |

Journal bodies require text (1–20,000 characters) and integer moodScore (1–5).
Optional tags default to []; timezone defaults to UTC; region defaults to GLOBAL.
Mood bodies accept moodScore, energy (1–5), sleepHours (0–24), tags, note and
timezone. IANA timezone is supplied by the caller because Phase 1 profiles do not
store it. The server clock determines today's date; clients cannot backdate.
Read summaries accept timezone too. Calendar uses stored local-date labels.
Streak counts consecutive recorded days ending today or yesterday and is recomputed
from unique mood logs. Deleting a journal does not delete the independent mood log.
Journal edits update today's mood, not the original entry's date.

Unknown input properties are rejected. IDs belonging to another user return 404.
Errors use {timestamp,status,code,message,path,traceId}; every response includes
X-Trace-Id. The service assigns trace IDs and logs only method/status and safe
error codes, never bodies, bearer tokens or upstream error messages.
The default in-process rate limit is 120 requests/IP/minute. Proxy trust is disabled;
configure an explicitly trusted proxy and a shared limiter before scaling.

## Safety and consent

Create and edit order: validate → verify ownership/account → mandatory crisis
screen → save → dispatch allowed analysis reference → upsert mood → compute streak.
The HTTP AI crisis request aborts after two seconds. Timeout, network failures and
invalid responses invoke a local keyword fallback. This fallback is deliberately
simple and is not a substitute for the AI screening model.

MEDIUM/HIGH or fallback matches save the entry with crisisFlag and return a fixed
support message plus identity-managed resources. They never call emotion or
companionChat and never publish an analysis job. Crisis audits store only userId,
source, crisisDetected and createdAt: no text, risk score or risk level. The private
journal itself retains the submitted text as requested.

Identity's {aiAnalysis,companionMemory} is adapted to aiAnalysisOptIn.
Consent has a bounded in-memory 60-second cache; sensitive operations request
fresh consent. Circle restrictions and membership bypass the cache. Safety resources come from /crisis-resources, the existing Phase 1 public
directory; all /internal/* calls send X-Internal-Key. Directory failures use cached
resources; fixed support remains visible even with an empty directory response.
Identity events invalidate user caches. Companion-memory opt-out clears stored companion summaries. RestrictionService rejects nonmembers, muted and banned
users; Phase 5 exposes moderated circle posting and chat.

## Events and durability

Producer and consumer interfaces are in modules/events/events.service.ts.
Kafka consumers use group content-service for identity-events.
Offsets are manually committed only after processing or confirmed DLT delivery.
Processing has three attempts with 100/200 ms backoff. Commit failures propagate;
they are not misclassified as business-processing failures.
processed_events uses topic:eventId as its unique key and a seven-day TTL.

Event envelope: {id:UUID,type,version:1,occurredAt:ISO timestamp,payload}.
* identity-events: ConsentChanged, ModerationActionCreated, UserDeletionRequested.
  Deletion removes this phase's MongoDB data and publishes UserDeletionCompleted
  to content-events with the original stable event ID and {userId,requestId}.
* Failures publish metadata only to <source-topic>.DLT. Recover the original event
  by topic/partition/offset; raw malformed content is intentionally excluded.
  Phase 5 handles DataExportRequested; unsupported identity events go to DLT for visibility.

Journal entries no longer create AI analysis jobs. Startup removes retired analysis, jobId and jobPublished fields from journal_entries.

User-scoped transactions serialize writes with account deletion and retain a
tombstone, preventing in-flight requests or late results from recreating deleted data.
Result writes and handlers are idempotent across crash/rebalance redelivery.
Deduplication expires after seven days; archive/replay policies must respect that window.

Journal save and mood update are sequential operations, not one transaction across
Kafka and MongoDB. If a later step fails, the journal may already exist; inspect
GET /journal before retrying a failed create. No HTTP idempotency key is implemented.

## AI adapter boundary

HttpAiClient posts JSON with X-Internal-Key and the caller's bearer token:
crisisCheck → /safety/crisis-check ({text} → {riskLevel:LOW|MEDIUM|HIGH});
emotion → /emotion; companionChat → /companion/chat; moderate → /moderate;
Other methods accept/return unknown until the later AI implementation finalizes
its schemas. The adapter rejects non-2xx responses; non-crisis requests time out
after ten seconds. No generative HTTP routes are exposed here.

Phase 5 implements S3 files and JSON export assembly. Analysis workers remain
outside this service's implementation.

## Phase 4: companion

The new routes use the same port 8082, JWT authentication, MongoDB replica set,
and Kafka dependencies as Phase 2. Use `npm ci`, `npm run build` and `npm start`.
Dependencies and the lockfile include Socket.IO and the Phase 5 AWS SDK.
Keep npm audit enabled. No AI server is implemented here: configure a
compatible `AI_URL` for normal companion replies. Fixed crisis fallback works
when that server is unavailable.

| Method | Route | Behavior |
| --- | --- | --- |
| POST | /companion/conversations | Create with `{ "title": "Evening check-in" }`; returns `id` |
| GET | /companion/conversations | Owner-only listing; `cursor` and `limit` |
| GET | /companion/conversations/:id/messages | Owner-only messages newest first; `cursor` and `limit` |
| POST | /companion/conversations/:id/messages | Send `{ "text": "A quiet day", "timezone": "Asia/Singapore", "region": "GLOBAL" }` |
| DELETE | /companion/conversations/:id | Delete conversation and messages; 204 |
| GET | /companion/exercises | Fixed grounding/reflection exercises and disclaimer |

Run login on identity-service first. Use its access token on all routes above.
Create a conversation, send a message to its returned `id`, then list its messages.
For pagination, pass the returned `nextCursor` unchanged to the next request;
null means there is no next page. IDs belonging to another user return 404.
The default page size is 20, maximum 100.

### Companion processing and AI contract

Each turn saves the USER message, performs the existing mandatory crisis check,
and, if flagged, saves a CRISIS message containing the fixed support response.
That path makes no companion-chat, recommendation, or summary-generation call.
Crisis audits record `source=companion`, never message text.

Safe turns fetch fresh identity consent. Only `companionMemory=true` enables
cross-module context: average recorded mood across today and six previous local
dates, and top five themes from safe completed journal analyses created in the
last seven days. Missing mood data produces null, not zero. No raw journal text
is sent to chat. Consent is checked again before the call.

`POST /companion/chat` on the AI service receives:

```json
{
  "messages": [{ "role": "user", "content": "A quiet day" }],
  "context": { "averageMood": 3.5, "topThemes": ["walking"] },
  "summary": "",
  "disclaimer": "DayFeel supports wellbeing and self-reflection. It does not diagnose, treat, or replace professional care."
}
```

`context` and `summary` are absent when memory consent is off. The AI must return
`{ "reply": "..." }`, with 1–20,000 non-whitespace characters. Requests carry
the user's bearer token and `X-Internal-Key` through the existing AI adapter.
AI failures return 503; the user message remains saved. Inspect message history
before resending because message POSTs do not provide idempotency keys.

History contains at most 20 screened safe messages from this conversation.
Flagged, CRISIS, and unscreened turns are excluded from later prompts. A bounded
extractive summary is updated every five replies while memory consent is on;
it adds no extra LLM call. Memory opt-out clears summaries and suppresses their
use. Current-conversation safe history still supports normal chat when memory is
off. A database lease rejects simultaneous sends to one conversation with 409;
an abandoned lease can be reclaimed after two minutes. Deleting a conversation
or account during a reply cannot recreate its messages.

### Analysis results

Journal AI analysis and weekly insights have been removed. Notification delivery,
HTTP routes and sockets have been removed. Startup drops only the retired
notifications, notification_preferences and weekly_insights MongoDB collections.
Restart content-service after upgrading so old code cannot recreate these records.

### Phase 4 validation

```text
npm run typecheck
npm run validate:openapi
npm test
```

Tests cover crisis short-circuiting, consent-gated context, ownership, pagination,
summaries, deletion races and chat authentication.
Phase 5 also tests real Socket.IO connections, signed JWTs, moderation and rate limits.

Implementation references: [jose remote JWKS options](https://github.com/panva/jose/blob/main/docs/jwks/remote/interfaces/RemoteJWKSetOptions.md)
and [KafkaJS manual commits](https://kafka.js.org/docs/2.1.0/consuming).

### Conversation names

New conversations start as `New conversation`. The first persisted user message
sets a whitespace-normalized title of at most 80 characters for default-titled
conversations. Later messages do not replace it. A custom name supplied at
creation is preserved. `PATCH /companion/conversations/{id}` accepts
`{"title":"Exam reflections"}` (trimmed, 1?120 characters), requires ownership,
and prevents subsequent automatic naming. Existing conversations with message
history are not bulk-renamed; their owners can rename them in the companion UI.

## Swagger UI

After rebuilding and restarting this service, open http://localhost:8082/docs.
The OpenAPI JSON is at http://localhost:8082/openapi.json. The documentation is
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

Cleanup: content image upload URLs are retired. Existing file downloads and privacy cleanup remain supported; profile images use identity-service.
