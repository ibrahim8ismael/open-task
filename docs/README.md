# Open-Task Docs Index

> Source of truth for internal rebuild.
> Reference: `../plane-so` (business + code logic only, clean-room — do NOT copy Python).
> Constraints (remembered):
> - **Backend + DB: TypeScript + Prisma + Postgres only. No Python.**
> - **Frontend: reuse `apps/web` as-is.**
> - **Ignore: AI agent, AI APIs, OpenAI/LLM, embeddings, AI endpoints.**

## Docs

0. `00-repo-pattern.md` — repo shape for frontend + backend, workspaces/scripts, change policy, DoD
1. `01-backend-architecture.md` — NestJS service layout (NO Python libs), how `apps/web` talks to us, auth, Schedule jobs
2. `02-database-schema.md` — full Prisma schema plan ported from Django models (no AI tables)
3. `03-business-logic.md` — sequence IDs, completed_at sync, soft-delete, cycle/module progress, permissions, background rules
4. `04-api-contracts.md` — REST endpoints the TS backend must implement to satisfy `apps/web/core/services`
5. `05-backend-build-plan.md` — phased build order for backend + DB

## Quick decisions

* DB: Postgres 16, Prisma 7, UUID PKs (`uuid()`), soft-delete via `deletedAt`, partial uniques via migrations
* Auth: HTTP-only session cookie (compat with `withCredentials:true`) + `X-Api-Token` for tokens. No Django, no JWT-required. Simple auth: email/password + Google/GitHub OAuth
* Jobs: NestJS `@nestjs/schedule` `@Cron()` in-process for v1 (no Python Celery/Beat, no RabbitMQ). Queues later if needed
* Files: local disk in v1, S3-compatible env slot reserved (`S3_*`)
* Out of scope: everything under `ai/`, `agent/`, `llm/`, `openai`, `pages/ai`, AI search/summaries
