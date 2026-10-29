DAYFEEL APP
===========

DayFeel is a mood-tracking and companion web app. It is made up of a React
frontend and three backend services, backed by MySQL, MongoDB and Kafka.


REPOSITORY LAYOUT
-----------------
frontend/                 React 18 + TypeScript + Vite + Tailwind CSS web app
                          (React Router, TanStack Query, Zustand, Axios,
                          Socket.IO). Tests: Vitest and Playwright (e2e).
services/identity-service Java (Maven) service. Accounts, auth (JWT),
                          onboarding, sessions/reports, avatar storage.
                          Port 8081. MySQL + Flyway migrations.
services/content-service  Node/TypeScript service. Content, companion chat,
                          Socket.IO. Port 8082. MongoDB. Tests: Jest.
services/ai-service       Python service (app.py). Companion replies,
                          moderation and weekly insights. Tests: pytest.
infra/                    Local docker-compose (MySQL, MongoDB, LocalStack S3,
                          Kafka) and init scripts.
deploy/ec2/               EC2 deployment helpers (Caddyfile, Docker install,
                          env init, Kafka topics, S3 policy). See the README.txt
                          in that folder.
docker-compose.ec2.yml    Full production-style stack: web, identity, content,
                          ai, mysql, mongo, kafka, caddy.
docs/                     Technical document, presentation, high-level design
                          (application-hld.html).
tools/                    Bruno API collection generator/export scripts for the
                          identity service.


PREREQUISITES
-------------
- Node.js 22 LTS and npm
- Java and Maven (identity-service)
- Python 3 (ai-service)
- Docker and Docker Compose (for the infra / EC2 stacks)


RUNNING THE FRONTEND LOCALLY
----------------------------
From the frontend/ folder:

    npm ci
    copy .env.example .env        (PowerShell: Copy-Item .env.example .env)
    npm run dev

Open http://127.0.0.1:5173

Vite proxies /api/identity to 8081, /api/content to 8082 and /socket.io to
8082, so identity and content services must be running. Only public endpoint
URLs belong in VITE_* variables - never put internal keys, AWS or AI
credentials in the frontend environment.

Other frontend scripts:

    npm run build           Type-check and build for production
    npm run preview         Preview the production build
    npm test                Unit tests (Vitest)
    npm run test:e2e        End-to-end tests (Playwright)
    npm run types:generate  Regenerate API types from docs/openapi/*.json


RUNNING THE BACKEND SERVICES
----------------------------
Local dependencies (MySQL, MongoDB, LocalStack, Kafka):

    docker compose -f infra/docker-compose.yml up -d

Each service has its own README with build, run and test instructions:

    services/identity-service/README.md
    services/content-service/README.md
    services/ai-service/README.md

Normal companion replies, moderation and weekly insights require a compatible
AI service. Identity STORAGE_MODE=local does not support avatar uploads.


DEPLOYING TO EC2
----------------
The EC2 stack is defined in docker-compose.ec2.yml. Required environment
variables (no defaults) include DB_PASSWORD, INTERNAL_KEY,
JWT_PRIVATE_KEY_BASE64, JWT_PUBLIC_KEY_BASE64 and S3_BUCKET. Helper scripts
(init-env.py, install-docker.sh, init-topics.sh) are in deploy/ec2/.

    docker compose -f docker-compose.ec2.yml up -d --build

Never commit secrets or .env files.


TESTING SUMMARY
---------------
frontend            npm test / npm run test:e2e
identity-service    mvn test
content-service     npm test
ai-service          pytest
