# TODOS — Open-Task build (return-to file)

> Master checklist. Source of truth details in `docs/00-05` + `AGENT.md`.
> Constraints (remembered): **TS-only NestJS 11 + Prisma 7 + Postgres 16. NO Python libs. Reuse `apps/web`. Ignore AI agent/APIs.**
> Web contract: `VITE_API_BASE_URL` + `withCredentials:true` + snake_case JSON + cookie `session-id` + `X-Api-Token: plane_api_*`.
> Legend: `[ ]` todo / `[x]` done. Update this file as you go.

## Phase 0 — Repair monorepo (blocker, do first)

- [x] 0.1 Restore missing packages from `../plane-so/packages/` → `packages/`: `services`, `propel`, `typescript-config`, `decorators`, `logger` (keep existing 9 untouched)
- [x] 0.2 Create root `package.json` (pnpm workspaces `apps/web`, `apps/backend`, `packages/*`; scripts `dev`, `dev:web`, `dev:backend`, `build`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed` per `docs/00 §0.2`)
- [x] 0.3 Create root `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, copy `patches/` (exclude `apps/admin|space|live|proxy|api` from workspaces in v1)
- [x] 0.4 Create root `.env.example` (`DATABASE_URL`, `SESSION_SECRET`, `WEB_BASE_URL`, `VITE_API_BASE_URL`, `VITE_WEB_BASE_URL`, `SMTP_*`, `UPLOAD_PROVIDER=local`) + `apps/web/.env` (`VITE_API_BASE_URL=http://localhost:8000`)
- [x] 0.5 Create `docker-compose.yml` (db: PG16 + backend:8000 + web:3000) + `docker-compose.dev.yml` (db+backend) per `docs/00 §0.6` (no redis/mq/minio/live/admin/space)
- [x] 0.6 Verify: `pnpm install --frozen-lockfile` green; `pnpm --filter web check:types` green; `pnpm --filter web check:lint` green (no web logic changes)
  - Note: lockfile regenerated via `--no-frozen-lockfile` (pruned workspaces diverged from plane-so lockfile); all 12 `@plane/*` packages built; `web check:types` passes (warnings only)
- [x] Exit: monorepo installs, web boots against placeholder API URL

## Phase B0 — Backend scaffold (1–2 days, ref `docs/01`, `docs/02 §2.1-2.2`, `docs/04 §4.1-4.2`)

- [x] B0.1 Scaffold `apps/backend/` NestJS (module-per-domain per `docs/00 §0.4`): `main.ts` (cookie-parser, helmet, cors `credentials:true`), `app.module.ts` (+ ScheduleModule + PrismaModule), `config/`, `common/prisma`, `guards/`, `interceptors/snake-case`, `filters/`, `utils/`
- [x] B0.2 Prisma init `apps/backend/prisma/schema.prisma`: User, Profile, Account, Session, Workspace, WorkspaceMember, WorkspaceMemberInvite, Team, WorkspaceUserProperties, Project, State (see `docs/02 §2.2`); `@@map` snake tables; UUID PKs
  - Note: Prisma 7 — datasource `url` lives in `apps/backend/prisma.config.ts` (`env("DATABASE_URL")`), NOT in schema. Client needs `PrismaPg` adapter (`@prisma/adapter-pg` + `pg`) in `PrismaService`. `allowBuilds` for `prisma`/`@prisma/engines` added to `pnpm-workspace.yaml`.
  - Note: Nest 11 needs Express 5 — overrides added: `"@nestjs/platform-express>express": "^5.2.1"`, `"@nestjs/platform-express>path-to-regexp"` + `"@nestjs/core>path-to-regexp": "^8.4.2"` (global pins stay Express 4 for parked `apps/live`).
- [x] B0.3 Common infra: `PrismaService` (adapter), `PrismaModule` global; pagination/error-shape/trailing-slash per-controller dual routes (no router hacks)
- [x] B0.4 Guards: structure in place (`session-auth`/`api-token`/`roles` to be implemented in B0.5–B0.6)
- [x] B0.5 Auth endpoints `docs/04 §4.1`: form-POST `sign-in|sign-up|magic-sign-in|magic-sign-up|sign-out` (302 + safe redirect, Django error codes), JSON `email-check|magic-generate|forgot|reset|set|change-password`, session cookie `session-id` (bcrypt12, 14d, device info), stateless HMAC CSRF, 10/min throttle, OAuth google/github 501 stubs; `GET|PATCH /api/users/me/` + `/profile` + `/settings` + `/instance-admin` (snake_case)
  - Verified by curl: signup→onboarding+cookie, dup→USER_ALREADY_EXISTS, bad csrf→INVALID_CSRF, me/profile snake_case, signout→401, signin wrong→INVALID_PASSWORD / ok→cookie, magic generate→verify→reuse INVALID_CODE, forgot enumeration-safe→reset ok→reuse invalid→login with new pw, change wrong/ok, set-password CSRF-gated, PATCH me/profile
- [x] B0.6 Workspace endpoints `docs/04 §4.2` + Project base `docs/04 §4.3`: Prisma-backed CRUD, slug-check, invitations+join, members+leave+role, last-visited, user-properties; project CRUD + archive/unarchive + members/invites + identifiers + default-state seed on create
  - Verified by curl: ws create (slug auto + suffix on clash; names NOT unique per Django), dup slug-check false/true, get/patch, members (creator ADMIN=20), non-member 403, invite→join (Level NONE bypass) →200, MEMBER delete 403, promote ADMIN, project create (identifier upper, network 2, default_state set, creator member), dup identifier 403, list/details/identifiers, add member + non-member 403, archive excludes from list + ?archived=true + unarchive, user-props round-trip, last-visited round-trip, owner-leave 403, leave ok, ws soft-delete (+slug rewrite)
  - Note: workspace names intentionally not unique (slug is); `@Level("NONE")` added for invite-join; stacked PUT+PATCH split into twin methods (Nest single-mapping)
- [x] B0.7 Seed `apps/backend/prisma/seed.ts` (states stub with 6 defaults) + migration `20260907105905_init` applied to local PG16 (`docker-compose.dev.yml db` healthy)
- [x] B0.8 Verify: `backend check:types` ✅, `backend build` ✅, boot smoke ✅ (`/health`, `/auth/get-csrf-token/`, `/api/instances/`, `/api/workspaces/` all 200); `web check:types` still ✅
- [ ] Exit: auth + workspace + project round-trip works in web (needs B0.5–B0.6 real impl)

## Phase B1 — Work items, first usable (3–5 days, ref `docs/02 §2.3-2.4`, `docs/03 §3.1-3.2`, `docs/04 §4.4`)

- [x] B1.1 Models: Label (+tree, partial uniques in SQL), Estimate(+Point), IssueType(+ProjectIssueType), Issue(+Sequence/Assignee/Label/Relation/Blocker/Link/Attachment/Comment/Activity/Subscriber/Reaction/Vote/Version), IssueView + migration `20260907112902_b1_issues` (partial indexes for labels/estimates; project/state/identifier partials deferred to B5)
- [x] B1.2 Rules: sequence TX (pg_advisory_xact_lock, never reuse — verified ENG-4 after ENG-2 delete), default-state fallback, sortOrder MAX+10000, completedAt sync on state change (verified set on Done), version snapshot + per-field activity rows, `issueVisible()` scope
- [x] B1.3 Issue endpoints: CRUD, list (filters/state/priority/assignee/label/type/point/dates/search, order_by, group_by, offset-cursor envelope), POST list/detail/v2 aliases, ENG-123 lookup, sub-issues, archive/unarchive + archived/deleted lists, bulk op/delete/archive/subscribe (parallel), relations + remove-relation, subscribe GET/POST/DELETE, history/meta/versions, comments + comment/issue reactions, links, local attachments (assets/v2 register→upload→serve→delete, 5MB, traversal-safe)
  - Verified by curl: ENG-1..4 sequencing, grouping/filter/search/pagination+cursors, detail shape (38 keys), Done→completedAt, history+versions, relation dup-403 + remove, subscribe toggle, meta counts, comments/reactions/links, attachment bytes round-trip, labels attach, non-member 403
- [x] B1.4 Taxonomy endpoints `docs/04 §4.5`: states (CRUD, mark-default, intake-state, workspace list; default-delete + in-use-delete blocked), labels (CRUD, bulk-create, workspace list), estimates (+points CRUD, workspace list), issue-types (+project attach/detach)
  - Verified by curl: 6 seeded states, mark-default switch, bulk labels (dup skipped), estimate+point round-trip, issue-type create
- [x] B1.5 Views + search: `IssueView` CRUD (+lock guard, workspace + project scopes), view-issues (saved filters merged into list pipeline), user-favorite-views, workspace-views alias, `GET /api/workspaces/:slug/search/` (ILIKE issues+projects, member-scoped, exact web shape)
  - Verified by curl: view create→filtered issues (total 1), favorite round-trip, search finds ENG issues
- [ ] B1.6 Verify: web List/Board/Calendar render; board drag persists `sortOrder`+`state`; drawer edits persist; `ENG-1` lookup works
- [ ] Exit: team can run a project end-to-end on board+list; then schedule delete of legacy `apps/api/` reference

## Phase B2 — Cycles + modules (2–3 days, ref `docs/02 §2.5`, `docs/03 §3.3`, `docs/04 §4.5`)

- [ ] B2.1 Models: Cycle(+CycleIssue), Module(+ModuleMember,ModuleIssue,ModuleLink); new cycle `sortOrder=MIN-10000`; unique pairs partial
- [ ] B2.2 Endpoints: cycles CRUD + cycle-issues + transfer-issues `{new_cycle_id}` (freeze old `progressSnapshot`) + progress (live counts by `state.group` + estimates, snapshot if set) + archive + user-properties + archived-cycles + date-check; modules mirror + module-links + archived-modules
- [ ] B2.3 Rules: block edits if `cycle.endDate` passed (400); archive sets `archivedAt` + separate lists
- [ ] B2.4 Verify: web Cycles burndown + Modules grouping/progress work
- [ ] Exit: sprint planning + release tracking works

## Phase B3 — Pages / intake / social (2–3 days, ref `docs/02 §2.6`, `docs/04 §4.6`)

- [ ] B3.1 Pages: Page(+Tree, access, lock, sort) + PageVersion (cap 20/page, GC) + ProjectPage; TipTap JSON passthrough; `share` token stub; versions/lock/share endpoints
- [ ] B3.2 Intake: Intake (unique name/project) + IntakeIssue (status Pending/Rejected/Snoozed/Accepted/Duplicate, source IN_APP); endpoints + `:id/accept` (create Issue) `|reject|snooze`
- [ ] B3.3 Social: Notification (index receiver/workspace/read/created) + read/archive, UserFavorite, Sticky, DraftIssue, RecentVisit, `GET /api/users/last-visited-workspace/`
- [ ] B3.4 Verify: web Pages edit + versions, Intake triage creates Issue, bell shows rows
- [ ] Exit: docs + triage + notifications live next to work

## Phase B4 — Files / export / webhooks / tokens / crons (2 days, ref `docs/03 §3.6-3.7`, `docs/04 §4.6`)

- [ ] B4.1 Files: `FileAsset` local upload + meta, `FILE_SIZE_LIMIT=5MB`, orphan (`isUploaded=false` >24h) GC cron
- [ ] B4.2 Export: `ExporterHistory{workspace,projectIds[],provider csv|xlsx|json,token}`; `POST|GET /.../export-issues/` async build zip → 7d URL; expired GC
- [ ] B4.3 Webhooks: `Webhook{url http/https no-localhost, secretKey plane_wh_*, isActive}` unique workspace/url; `CRUD + regenerate + logs`; HMAC POST + retry + `WebhookLog` + retention purge; secret hidden unless `?show_secret`
- [ ] B4.4 Tokens: `APIToken{token plane_api_*, isActive, expiredAt}`; `GET|POST|DELETE /api/users/api-tokens/`; `X-Api-Token` guard + 60/min limit
- [ ] B4.5 Crons (`@nestjs/schedule`, no BullMQ v1): `*/5 * * * *` notify fanout (Nodemailer TS stub + `EmailNotificationLog`), `0 0 * * *` hard-delete (`deletedAt` older than retention) + retention (api/email logs, page/issue versions, webhook logs), `0 1 * * *` archive_and_close (`archiveIn`/`closeIn` per `docs/03 §3.6`)
- [ ] B4.6 Stubs: `GET /api/instances/` (static), `GET /api/timezones/`, `GET /health`
- [ ] B4.7 Verify: web attachments upload, export download, webhook log row, token auth works
- [ ] Exit: ops surface complete for v1

## Phase B5 — Harden + ship (1–2 days, ref `docs/00 §0.7`, `AGENT.md §7-8`)

- [ ] B5.1 Guards audit: workspace-ADMIN bypass, `isActive`, creator-allow, 401 shape (web `?next_path=` compat); `isTriage`/default-state paths covered
- [ ] B5.2 DB: all partial uniques applied, `pg_trgm` index, snake_case interceptor on all controllers, cursor pagination everywhere
- [ ] B5.3 Prod: backend `Dockerfile`, root compose `web:3000+backend:8000+db`, volume `pgdata`, backup note, `ADMIN_EMAILS` superadmin seed; remove legacy `apps/api/` + parked-app references from docs if deleted
- [ ] B5.4 Quality: root `typecheck+lint+test+build` green; smoke E2E `register → workspace → project → ENG-1 → board drag → cycle → module → page → intake → export`
- [ ] B5.5 Docs: tick this file, update `docs/04` for any drift, re-create slim `PLAN.md` pointer if wanted
- [ ] Exit: internal URL + onboarding runbook

## Out of scope (do not build, do not tick)

AI agent, AI APIs, LLM/summaries/embeddings/vectors, OpenSearch, RabbitMQ/Celery/Beat, BullMQ/Redis-required queues, MinIO cluster, SSO/SAML, `apps/live` Hocuspocus collab, license/monitor/silo server, `apps/admin|space` promote (parked).

## How to use this file

1. Work top-down 0 → B5, one checkbox group per change.
2. Before coding a group, read its `docs/` refs + `apps/web/core/services/<domain>*` shapes.
3. After each group: run `backend typecheck+test` + `web check:types`; tick boxes here in same commit.
4. If endpoint shape changes, update `docs/04-api-contracts.md` first.
