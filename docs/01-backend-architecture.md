# 01 — Backend Architecture (TypeScript + NestJS + Prisma — NO Python)

> CONFIRMED: We will NOT use any Python libs (no Django/DRF/Celery/gunicorn/requirements.txt).
> All backend work is TypeScript + NestJS + Prisma. `apps/api` (Python) is reference-only, never run/deployed.
> Replaces `plane-so/apps/api`. AI ignored.

## 1.1 Target layout (`apps/backend/` NestJS, separate from `apps/web`)

> Stack lock: NestJS 11 + Prisma 7 + Postgres 16 + Redis optional (cache only). No `requirements*.txt`, no `manage.py`, no Celery/Beat/RabbitMQ Python workers.

```
apps/backend/
  src/
    main.ts                 # Nest bootstrap (cookie-parser, helmet, cors credentials:true)
    app.module.ts           # imports all modules + ScheduleModule + PrismaModule
    config/ (env.validation.ts, db.ts)
    common/ (prisma/prisma.service.ts+prisma.module.ts, guards/session-auth.guard.ts+api-token.guard.ts+roles.guard.ts, decorators/roles.decorator.ts+current-user.decorator.ts, interceptors/snake-case.interceptor.ts, filters/http-exception.filter.ts, utils/pagination.ts+sequence.ts)
    modules/
      auth/                 # session login/logout, magic, google/github oauth, reset, csrf stub
      users/ + profiles/ + accounts/
      workspaces/ + workspace-members/ + invites/ + user-properties/
      projects/ + project-members/ + identifiers/
      states/ + labels/ + estimates/ + issue-types/
      issues/ (+ sub-issues, links, attachments, comments, reactions, votes, subscribers, versions, history)
      cycles/ + modules/
      views/ (IssueView saved filters)
      pages/ (TipTap JSON, versions, logs, labels, project-pages)
      intake/ (intakes + intake-issues triage)
      notifications/ + favorites/ + stickies/ + drafts/ + recent-visits/
      assets/ (FileAsset upload/meta) + exporter/ + webhooks/ + search/
      health/ + instances/  # GET /health, GET /api/instances/ stub
  prisma/
    schema.prisma           # see 02-database-schema.md
    migrations/
    seed.ts                 # default states, roles, demo workspace
  package.json, tsconfig.json, Dockerfile
```

Why NestJS (locked, not Express/Fastify-plain): Plane permission model (`WORKSPACE` vs `PROJECT` level, roles 20/15/5) maps to Nest Guards + `@Roles()` + `@Level()` decorators; Modules/Controllers/Services mirror Django `app/urls/*` files 1:1; built-in ValidationPipe (zod/class-validator), Schedule (`@Cron`), and testing.

## 1.2 How `apps/web` talks to us (must stay compatible)

From audit of `apps/web`:

* Transport: `axios.create({ baseURL: VITE_API_BASE_URL, withCredentials: true })` in `core/services/api.service.ts`. Only `@plane/services` usage is API-tokens + file-upload helpers; rest is inline `core/services/*`.
* Base: `VITE_API_BASE_URL` (required, e.g. `http://localhost:8000`), `API_BASE_PATH=""`. Endpoints like `GET /auth/get-csrf-token/`, `POST /auth/email-check/`, `/api/instances/`, `/api/users/me/`.
* Auth: cookie session (Django `login()` stores `session.device_info`). No JWT in web flow. Our TS backend must set HTTP-only session cookie + support `X-Api-Token: plane_api_*` for token auth (see 04).
* Env to provide: `VITE_API_BASE_URL`, `VITE_WEB_BASE_URL=:3000`, `ADMIN_:3001`, `SPACE_:3002`, `LIVE_:3100` (last three can be empty in v1).

## 1.3 Auth strategy (simple, TS)

* Session table (`sessions(sessionKey PK, sessionData, expireAt, deviceInfo, userId)`) via Prisma + cookie (`session-id` HTTP-only, SameSite=Lax, Secure in prod).
* Flows: email+password (bcrypt), magic code (6-digit, hashed, 10min TTL), OAuth `google/github` initiate→callback→provision user + workspace membership, forgot/reset via signed token, `GET /auth/get-csrf-token/` returns token for web init.
* CSRF: v1 `enforce_csrf=no-op` compat (web doesn't send CSRF header); add origin check + SameSite instead of breaking web.
* Rate-limit auth routes 10/min/IP.

## 1.4 Jobs with Nest Schedule (no Python Celery/Beat, no RabbitMQ)

Plane uses Python Celery+Beat+RabbitMQ + `stack_email_notification` every 5m + daily crons. Our TS replacement:

* `@nestjs/schedule` in backend: `@Cron('*/5 * * * *')` notification fanout stub, `@Cron('0 0 * * *')` hard-delete + retention GC, `@Cron('0 1 * * *')` archive_and_close (see 03).
* Long tasks (export zip, webhook POST): Nest `@InjectQueue` is OUT (no BullMQ/Redis required in v1) — use async service + DB row (`ExporterHistory`, `WebhookLog`) polled by frontend. Add BullMQ later only if needed.
* Email: Nodemailer (TS) SMTP stub, templated; log to `EmailNotificationLog`. No Python `smtplib` tasks.

## 1.5 Files / search / realtime (v1 cuts)

* Files: local `./uploads` + `FileAsset` row; presigned-URL shape kept so S3/MinIO can replace later. `FILE_SIZE_LIMIT=5MB`.
* Search: Postgres `ILIKE` + trigram (`pg_trgm`) in v1, no OpenSearch.
* Realtime: none in v1 (skip `apps/live` Hocuspocus). Pages save via REST versions.
* Instances/license/monitor/silo: stub `GET /api/instances/` with static config; skip license validation.

## 1.6 Config

```
DATABASE_URL=postgresql://...
SESSION_SECRET=...
WEB_BASE_URL=http://localhost:3000
SMTP_HOST/PORT/USER/PASS=
UPLOAD_PROVIDER=local
S3_ENDPOINT/S3_BUCKET/S3_KEY/S3_SECRET= (reserved)
```

Health: `GET /health` + `GET /api/instances/`.
