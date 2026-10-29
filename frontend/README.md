# DayFeel frontend — Phase 7

React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Zustand,
Axios and Socket.IO. Soft yellows, warm brown text, generous spacing, native
keyboard controls, and reduced-motion support. Mood charts use accessible SVG
with an equivalent data table.

## Start without Docker

Start identity (8081), content (8082), and their dependencies using the
[native setup guide](../docs/start-and-test-without-docker.md). Rebuild identity
first: Phase 7 adds a Flyway migration for persistent onboarding and authenticated
session/report endpoints. Existing accounts complete onboarding once after upgrade.

From `dayfeel/frontend`, with Node 22 LTS:

```cmd
npm ci
copy .env.example .env
npm run dev
```

Open **http://127.0.0.1:5173**. In PowerShell use `Copy-Item .env.example .env`.
Copy the example only for initial setup; preserve an existing `.env`. Keep npm
audit enabled. Vite proxies `/api/identity` to 8081, `/api/content` to 8082, and
`/socket.io` to 8082. No internal key belongs in the browser environment.
Only public endpoint URLs belong in `VITE_*` variables. Never include internal,
AWS or AI credentials. Normal companion replies, moderation and weekly insights
require a compatible AI service. Identity `STORAGE_MODE=local` does not support
avatar uploads; onboarding can continue without one.

## First use

1. Register with email and a password of 12–72 characters.
2. Pick an alias, optionally upload an image, choose consent flags (all off by
   default), and acknowledge the wellbeing disclaimer.
3. Save a check-in or write an entry. The dashboard chart updates from the mood API;
   its table provides exact values without relying on color.
4. Join a circle before opening its feed or live chat. Only aliases appear in
   community views. Held content is acknowledged privately.
5. Settings lets you change consent, export data, and confirm deletion.
   Export preparation is polled while the page is open; bookmark its request URL
   to return later. The backend verifies ownership on every read.

The top bar always provides **Need help now?**. `/help/crisis` is public. Any API
response with a crisis support payload opens a native full-screen modal; Escape
and background clicks cannot dismiss it. The originating action waits for
acknowledgement. Chat acknowledgements use the same crisis handler.

## Authentication and authorization

Tokens are held in memory and **sessionStorage** for the current tab, so page reloads
preserve login. Roles and onboarding status are fetched again from identity-service;
they are never trusted from storage. Sign-out clears saved tokens. Browser session
storage normally ends when the tab closes (session restoration depends on the browser).
Tokens remain accessible to same-origin JavaScript; an HttpOnly cookie flow would
require a separate backend authentication change. Axios shares one refresh among
concurrent 401 responses, retries each request once, and clears auth on failure.
Session-generation checks reject late responses after logout/account switching.
Query caches are cleared when the session changes.

`GET /me/session` returns database-derived roles and `onboardingComplete`;
`POST /me/onboarding` requires `{acknowledged:true}`. UI guards are navigation aids;
all privileged actions retain backend authorization. Moderator/admin navigation
requires the corresponding global role assigned through trusted identity
administration. Users cannot grant roles through the frontend. Circle-scoped
moderator authorization is also enforced by identity's report/action endpoints.

The report queue uses `GET /circles/:circle/reports?page=0` and detail uses
`GET /reports/:report`. They return reference/category metadata, not private text
or reporter identity. Admin screens list/create circles and create/edit/remove
support resources. Circle rename/delete and report-resolution status have no
backend API and are not invented here. Admin/moderator circle selectors currently
show the first 20 circles; the public directory has pagination.

## API types and uploads

`src/types/*.generated.ts` come from committed OpenAPI specs. Regenerate with
`npm run types:generate`. Typed API modules are in `src/api`. Query keys include
`["journal", filters]`, `["mood", "summary", range]`, `["posts", circleId]` and
`["circle-chat", circleId]`. Auth, UI notices and crisis queues use separate Zustand stores.
Sockets are cleaned up on navigation/sign-out and recreated when tokens rotate.
Circle chat loads saved history in batches of 50 and merges live messages.

FileUploader uses identity's presigned **S3 PUT** for avatars with the exact required
headers. JPEG/PNG/WebP up to 5 MiB are allowed. It also supports content-service's
size-constrained presigned **POST** for journal/community files; a POST policy is
never treated as a PUT URL. Storage requests use a separate Axios client without
DayFeel authorization. Configure bucket CORS for the frontend origin and signed
headers. Journal attachment linking is not offered because JournalInput has no
attachment field.

## Build and tests

```cmd
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Vitest/RTL cover keyboard mood selection, consent, mandatory crisis acknowledgement,
role/onboarding guards, concurrent refresh, one retry, refresh failure and logout
races. Playwright drives register → onboarding → entry → chart in Chromium and
checks mobile overflow/help access. Browser API responses are mocked; this does
not claim a live MySQL/MongoDB/Kafka/AI/S3 deployment. Screenshots/traces are in
ignored `test-results/`. CI runs type-generation drift checks, build and both suites.

Focus rings, native controls, visible labels, modal focus containment, a skip link,
status/error announcements, chart alternatives and `prefers-reduced-motion` are
included. The palette targets WCAG AA text contrast. Complete assistive-technology
auditing remains a release activity.

For deployment, serve `dist` with SPA fallback to `index.html` and route the same
three proxy paths through your trusted edge. `vite preview` previews static files;
it is not a production API gateway. The repository gateway and Docker frontend
container remain scaffolds; use the native run command above.
