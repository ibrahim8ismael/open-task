# AGENT.md — Open-Task (internal Plane-like rebuild)

> Read this first before any code change. Source of truth: `docs/` (00–05).

## 1. What this repo is

* `apps/web/` — Plane frontend reused as-is (React-Router SPA, MobX, axios `withCredentials:true`). Branding/`.env` only, no refactors during backend phases.
* `apps/backend/` (to build) — NEW NestJS API on `:8000` that satisfies `apps/web/core/services`.
* `apps/api/` — legacy Python/Django reference ONLY. Never run, never `pip install`, never import. Delete after backend B1.
* `apps/admin|space|live|proxy/` — parked for v1, excluded from workspaces.
* `packages/` — shared TS packages for web build (`services`, `propel`, `typescript-config`, `decorators`, `logger` must be restored for web build).
* `prisma/` lives in `apps/backend/prisma/` (single home). `docs/` is planning truth.

## 2. Hard constraints (non-negotiable)

1. **TS-only: NestJS 11 + Prisma 7 + Postgres 16. NO Python libs** (no Django/DRF/Celery/gunicorn/`requirements.txt`, no `manage.py` flows).
2. **No AI work:** ignore `ai/`, `agent/`, `llm/`, OpenAI, embeddings, AI endpoints/pages/search. Do not add AI deps or routes.
3. **Web compat first:** keep `VITE_API_BASE_URL` contract + snake_case wire JSON + cookie session (`session-id`) + `X-Api-Token: plane_api_*`. Web 401 interceptor redirects `/?next_path=` — return 401, don't break it.
4. **V1 infra:** `db + backend + web` only in compose. No Redis/BullMQ, no RabbitMQ, no MinIO cluster, no OpenSearch, no `apps/live` collab, no SSO/SAML.

## 3. Docs to read (in order)

* `docs/00-repo-pattern.md` — monorepo shape, turbo/pnpm scripts, DoD
* `docs/01-backend-architecture.md` — NestJS layout, auth, Schedule jobs
* `docs/02-database-schema.md` — Prisma models (UUID PKs, `deletedAt` soft-delete, partial uniques in migrations)
* `docs/03-business-logic.md` — ENG-123 TX, `completedAt` hook, soft-delete vs archive, cycle progress/snapshot/transfer, roles 20/15/5, crons
* `docs/04-api-contracts.md` — REST endpoints to implement (`/auth/*`, `/api/workspaces/:slug/...`)
* `docs/05-backend-build-plan.md` — phases B0→B5 (follow order)

Reference for logic only: `../plane-so` (clean-room, do not copy Python verbatim). Keep AGPL headers on reused frontend files.

## 4. Commands

```bash
# root (once root package.json/pnpm-workspace.yaml/turbo.json exist)
pnpm install --frozen-lockfile
pnpm dev:backend   # Nest :8000
pnpm dev:web       # web :3000 (needs VITE_API_BASE_URL=http://localhost:8000)
pnpm typecheck && pnpm lint && pnpm test && pnpm build

# backend only
pnpm --filter backend dev | build | test
pnpm --filter backend db:migrate | db:seed
npx prisma migrate dev --schema apps/backend/prisma/schema.prisma
npx prisma studio --schema apps/backend/prisma/schema.prisma

# web only (no logic changes)
pnpm --filter web check:types   # react-router typegen && tsc --noEmit
pnpm --filter web check:lint
```

Env (see `docs/00 §0.6`): `DATABASE_URL`, `SESSION_SECRET`, `WEB_BASE_URL`, `VITE_API_BASE_URL`, `SMTP_*`, `UPLOAD_PROVIDER=local`, `FILE_SIZE_LIMIT=5MB`.

## 5. Backend pattern (NestJS)

```
src/modules/<domain>/<domain>.module.ts
src/modules/<domain>/<domain>.controller.ts  # @Controller('api/...') snake_case DTOs
src/modules/<domain>/<domain>.service.ts     # Prisma + docs/03 rules
src/modules/<domain>/dto/<domain>.dto.ts     # class-validator
src/common/prisma/ | guards/ (session-auth, api-token, roles) | interceptors/snake-case | filters/ | utils/ (pagination, sequence, activity)
```

Rules:

* Every `DELETE` = soft (`deletedAt=now()` + cascade soft-delete; `SetNull`→nullify; skip `IssueActivity.issue`).
* List queries exclude `deletedAt!=null`, triage states, `archivedAt!=null`, `isDraft=true` via `notDeleted()`/`issueVisible()` helpers.
* `Issue.create` in TX: per-project lock (`FOR UPDATE` on `ProjectIdentifier`), `sequenceId=max+1`, `IssueSequence` row (never reuse), default state fallback, `sortOrder=MAX+10000`.
* `Issue.update stateId`: reload state group → set/clear `completedAt`; write `IssueVersion` + `IssueActivity{verb,field,old/new,actor}` + fanout.
* Permissions: `@Level(WORKSPACE|PROJECT)` + `@Roles(ADMIN,MEMBER,GUEST)`; workspace ADMIN bypasses project checks; check `isActive`.
* Outbound JSON camel→snake via interceptor; pagination `{results,next_cursor,count}` (`?per_page&cursor`); errors `{detail,field_errors?}`.
* Crons (`@nestjs/schedule`): `*/5 * * * *` notify, `0 0 * * *` hard-delete+retention (pages>20, versions>20, logs), `0 1 * * *` archive_and_close (`archiveIn`/`closeIn`).
* Files local `./uploads`, orphan GC; export async → `ExporterHistory{token}` zip URL 7d; webhook HMAC POST + `WebhookLog` + purge.

## 6. DB pattern

* `apps/backend/prisma/schema.prisma` single home, `@@map` to Django snake table names, enums in `docs/02 §2.1`.
* Migrations checked in; partial uniques `WHERE "deletedAt" IS NULL` via raw SQL (project identifier/name, state/estimate/intake/module name, issue pairs, reactions, webhook url, label splits).
* Seed: default states (Backlog/Todo/In Progress/Done/Cancelled/Triage) + demo workspace/project.
* Never store AI vectors/summaries; never add Python-migration tables.

## 7. Workflow for agents

1. Read relevant `docs/0X` + `apps/web/core/services/<domain>*` shapes before coding.
2. Implement in phase order B0→B5; one domain per change (auth→workspace→project→issue→cycle/module→views/pages/intake→misc).
3. Update `docs/04` if endpoint shape changes; never silently diverge from web expectations.
4. Verify: `backend typecheck+test` green AND `web check:types` still green + smoke (login → workspace → project → ENG-1 → board drag → cycle/module/page/intake).
5. DoD: no `.py`, no celery/ai imports in diff; `PLAN.md`/docs updated if scope shifts.

## 8. Don't

* Don't run `apps/api`, don't add `requirements`/`Dockerfile.api` services to compose v1.
* Don't rewrite `apps/web` store/services/routes; branding + `.env` only.
* Don't add `apps/live`, OpenSearch, S3 cluster, SSO, license server in v1.
* Don't copy Django code verbatim; port rules to TS per `docs/03`.
