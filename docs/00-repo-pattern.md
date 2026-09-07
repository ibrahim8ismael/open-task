# 00 — Repo Pattern (Frontend + Backend, TS-only monorepo)

> Single source for how `open-task/` is organized. Frontend reused, backend NestJS new. No Python runtime. AI out.

## 0.1 Root shape (target)

```
open-task/
  apps/
    web/            # Plane frontend (React-Router SPA, as-copied). DO NOT rewrite. Only .env + branding.
    backend/        # NEW NestJS API :4040 (TS only). See docs/01.
    # api/          # legacy Python reference — DO NOT run, DO NOT install requirements. Delete after B1.
    # admin/space/live/proxy/ # parked for v1, keep folder but excluded from install/build
  packages/
    # existing 9 kept for web build: constants, editor, hooks, i18n, shared-state, tailwind-config, types, ui, utils
    # + restore 5 for web build: services, propel, typescript-config, decorators, logger
  prisma/           # OPTION A: keep here if backend stays in apps/backend/prisma — pick one home, not both
  docs/             # 00..05 planning docs (this folder)
  package.json      # pnpm workspaces: apps/web + apps/backend + packages/*
  pnpm-workspace.yaml
  turbo.json        # tasks: build, dev, lint, typecheck, test
  docker-compose.yml       # web:3000 + backend:4040 + db:5432 (v1, no redis/mq/minio)
  docker-compose.dev.yml   # backend + db only for API dev
  .env.example
  PLAN.md
```

Rule: `apps/web` never imports from `apps/backend` directly. Only contract is HTTP (`VITE_API_BASE_URL`) + snake_case JSON (see `docs/04-api-contracts.md`).

## 0.2 Workspaces + scripts

`package.json` (root):

```json
{
  "private": true,
  "packageManager": "pnpm@9",
  "scripts": {
    "dev": "turbo run dev",
    "dev:web": "turbo run dev --filter=web",
    "dev:backend": "turbo run dev --filter=backend",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:migrate": "turbo run db:migrate --filter=backend",
    "db:seed": "turbo run db:seed --filter=backend"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/web'
  - 'apps/backend'
  - 'packages/*'
  # excluded v1 (uncomment when needed):
  # - 'apps/admin'
  # - 'apps/space'
  # - 'apps/live'
```

`turbo.json`:

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {}, "typecheck": { "dependsOn": ["^build"] }, "test": {},
    "db:migrate": { "cache": false }, "db:seed": { "cache": false }
  }
}
```

## 0.3 Frontend pattern (`apps/web` — keep as-is)

* Entry: `app/entry.client.tsx → root.tsx → layout.tsx → provider.tsx (StoreProvider > SWRConfig)`. `ssr:false`, static `serve` bundle.
* Routes: `app/routes/core.ts` — `/:workspaceSlug/projects/:projectId/{issues,cycles,modules,views,pages,intake}`.
* State: MobX `CoreRootStore` via `useMobxStore()`, `resetOnSignOut()`. Path alias `@/* → core/*`.
* Data: `core/services/* extends APIService` (axios `baseURL=VITE_API_BASE_URL`, `withCredentials:true`, 401→`/?next_path=`). Only `@plane/services` bits are tokens + upload helpers.
* Env: `apps/web/.env` from `.env.example` — set `VITE_API_BASE_URL=http://localhost:4040`, `VITE_WEB_BASE_URL=http://localhost:3000`, rest empty v1.
* Change policy: `.env` + `public/` branding + `manifest.json` only. No store/service refactors in backend phases.

## 0.4 Backend pattern (`apps/backend` — NestJS, TS only)

Module-per-domain, mirroring Django `app/urls/*` 1:1:

```
src/modules/<domain>/
  <domain>.module.ts
  <domain>.controller.ts  # @Controller('api/workspaces/:slug/...') snake_case I/O
  <domain>.service.ts     # Prisma + business rules (see docs/03)
  dto/<domain>.dto.ts     # class-validator, snake→camel transform in, camel→snake out
  <domain>.spec.ts
```

Cross-cutting (`src/common/`):

* `prisma/` service+module (single `PrismaClient`, soft-delete helper `notDeleted()`, `issueVisible()` scope)
* `guards/` `session-auth.guard.ts` (cookie `session-id` → `req.user`) + `api-token.guard.ts` (`X-Api-Token: plane_api_*`) + `roles.guard.ts` (`@Roles(ADMIN,MEMBER)` + `@Level(WORKSPACE|PROJECT)`, workspace-ADMIN bypass)
* `interceptors/snake-case.interceptor.ts` (outbound camel→snake for web compat)
* `filters/` + `utils/` pagination (`?per_page&cursor → {results,next_cursor,count}`), sequence (`advisory-lock via TX + FOR UPDATE`), activity fanout (`issueActivity()` writes `IssueActivity` + notifications + webhooks)

Data rules: UUID PKs, `deletedAt` soft-delete, partial uniques in migrations, `completedAt` hook on state change, `sequenceId` TX-only, versions capped (pages 20). See `docs/02`, `docs/03`.

Jobs: `@nestjs/schedule` `@Cron()` only (no BullMQ v1). Files local `./uploads`, `5MB` cap. Search `ILIKE+pg_trgm`.

## 0.5 DB pattern (Prisma home)

* Live schema in `apps/backend/prisma/schema.prisma` (single home). If `prisma/` at root exists, it must re-export, not duplicate.
* `migrations/` checked in, `seed.ts` creates default states + demo workspace. Partial indexes via raw SQL in migration (`WHERE "deletedAt" IS NULL`).
* Naming: Prisma camelCase in code, `@@map` to Django snake table names so existing `apps/web` field mapping + future data import stay stable.

## 0.6 Env + compose (v1)

`.env.example` (root):

```
DATABASE_URL=postgresql://open:open@localhost:5432/opentask
SESSION_SECRET=change-me
WEB_BASE_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:4040
VITE_WEB_BASE_URL=http://localhost:3000
SMTP_HOST/PORT/USER/PASS=
UPLOAD_PROVIDER=local
```

`docker-compose.yml` services: `db (postgres:16, volume pgdata)`, `backend (build apps/backend, :4040, env DATABASE_URL)`, `web (build apps/web, :3000, args VITE_API_BASE_URL)`. No `redis/mq/minio/live/admin/space` in v1.

## 0.7 Definition of done per change

* `pnpm --filter backend typecheck + test` green, `pnpm --filter web check:types` still green (no web break)
* New endpoint listed in `docs/04-api-contracts.md` + wired in web smoke (login → workspace → project → ENG-1 → board drag)
* No `.py`, no `requirements`, no `celery`, no `ai/` imports in diff
