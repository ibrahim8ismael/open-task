# 05 — Backend Build Plan (TS + Prisma, no Python, no AI)

## Phase B0 — Scaffold (1-2 days)

* [ ] Create `apps/backend/` (Nest or Express+Zod — lock one) + `prisma/schema.prisma` from `02-database-schema.md` (User→Workspace→Project→State first)
* [ ] `docker-compose.dev.yml`: `postgres:16 + backend:4040`; `DATABASE_URL`, `SESSION_SECRET`, `WEB_BASE_URL`
* [ ] Session auth: `sessions` table + cookie + `GET /auth/get-csrf-token/`, `POST /auth/email-check|sign-in|sign-up|sign-out`
* [ ] Seed: default states (Backlog/Todo/In Progress/Done/Cancelled/Triage), demo workspace/project
* [ ] Verify: `web` login → create workspace → create project (wire `VITE_API_BASE_URL=http://localhost:4040`)

## Phase B1 — Work items (first usable, 3-5 days)

* [ ] Full `02` Issue models + `03 §3.1/3.2` (sequence TX, completedAt hook, `issueVisible()` scope)
* [ ] Endpoints `04 §4.4` incl. `ENG-123` lookup, sub-issues, comments, attachments (local), reactions, history (`IssueActivity`)
* [ ] States/labels/estimates/issue-types CRUD + `mark-default`
* [ ] `IssueView` save/filter + search `ILIKE`
* [ ] Verify: web List/Board/Calendar render, drag updates `sortOrder`+`state`, drawer edits persist

## Phase B2 — Cycles + modules (2-3 days)

* [ ] `Cycle/Module` models + join tables + `03 §3.3` (progress live vs snapshot, transfer, closed-cycle guard, archive lists)
* [ ] Endpoints `04 §4.5`
* [ ] Verify: web Cycles burndown + Modules grouping work

## Phase B3 — Pages / intake / social (2-3 days)

* [ ] `Page + PageVersion (cap 20) + ProjectPage`, TipTap JSON passthrough, `share` token stub
* [ ] `Intake + IntakeIssue` triage `accept→create Issue / reject / snooze`
* [ ] `Notification + UserFavorite + Sticky + DraftIssue + RecentVisit`
* [ ] Verify: web Pages edit, Intake triage, bell shows rows

## Phase B4 — Files / export / webhooks / cron (2 days)

* [ ] `FileAsset` local upload + meta (`5MB` limit, orphan GC)
* [ ] `ExporterHistory` csv/xlsx/json async + 7d URL + GC
* [ ] `Webhook + WebhookLog` HMAC POST + retry + retention purge
* [ ] `APIToken (plane_api_*)` + `X-Api-Token` guard + rate-limit 60/min
* [ ] `node-cron`: `*/5m` notify, `00:00` hard-delete+retention, `01:00` archive_and_close
* [ ] `GET /api/instances/`, `/timezones/`, `/health` stubs
* [ ] Verify: `web` attachments, export download, webhook log row, token auth works

## Phase B5 — Harden (1-2 days)

* [ ] Guards per `03 §3.5` (workspace ADMIN bypass), `isActive` checks, 401→web redirect compat
* [ ] Partial unique migrations (`WHERE deletedAt IS NULL`), `pg_trgm` index, snake_case serializer for web compat
* [ ] `Dockerfile` prod + compose `web:3000 + backend:4040 + db`, backup note
* [ ] `typecheck + test (vitest) + build` green, smoke E2E: register → ENG-1 → board drag → cycle → module → page → intake → analytics stub

## Out of scope (do not build)

AI agent, AI APIs, LLM/summaries/embeddings, OpenSearch, RabbitMQ/Celery, MinIO cluster, SSO/SAML, `apps/live` collab, license server.
