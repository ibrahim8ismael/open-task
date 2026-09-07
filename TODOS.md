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
- [x] B1.6 Verify: web boots (200 on /, issues, cycles routes); board-drag sequence (PATCH state+sort → grouped columns correct), drawer-edit sequence (rename/priority/dates → history rows), ENG-1 lookup — all API-verified; full click-through pending human pass
  - Gap batch added for page loads: `GET /projects/details/`, project-stats (real issue/member counts, cycles/modules 0 until B2), project user-properties GET|PATCH (new ProjectUserProperty model), members/me, search-issues, user-favorite-projects CRUD, my project invites list/accept
- [ ] Exit: team can run a project end-to-end on board+list; then schedule delete of legacy `apps/api/` reference

## Phase B2 — Cycles + modules (2–3 days, ref `docs/02 §2.5`, `docs/03 §3.3`, `docs/04 §4.5`)

- [x] B2.1 Models: Cycle(+CycleIssue join, CycleUserProperties), Module(+ModuleMember, ModuleIssue, ModuleLink, ModuleUserProperties) + migration `20260907115740_b2_cycles_modules` (partial unique module name/project; new cycle sortOrder = MIN-10000 applied in service)
- [x] B2.2 Endpoints (`apps/backend/src/modules/tracking/`): cycles CRUD + cycle-issues add (bridge UUID)/remove/list + transfer (snapshot old, move incomplete) + progress & cycle-progress (snapshot-if-frozen else live group/estimate/distribution) + archive/restore + archived-cycles + date-check + favorites + workspace active/all lists; modules CRUD + issues add/remove + per-issue modules attach/detach + module-links + archive + favorites + workspace list; issue serializer resolves cycle_id/module_ids; project-stats counts cycles/modules
  - Verified by curl: Sprint sort/progress 2-1-1, transfer (1 moved, snapshot frozen), closed-cycle edit 403, archive/restore, favorites, active-cycles, module in-progress round-trip (Prisma @map fix), drawer shows cycle+module
  - Fixes: user-favorite-* at project-level paths; ModuleStatus wire map; P2002-only duplicate errors
- [x] B2.3 Rules: closed-cycle edit/add block (403; transfer-out allowed, transfer-in blocked); archive sets `archivedAt` + separate lists + restore; delete cascades joins then soft-deletes
- [x] B2.4 Verify: cycle-issues envelope renders board/list; module detail progress bars fed by annotated counts; burndown charts read progress endpoint (snapshot-aware)
- [ ] Exit: sprint planning + release tracking works

## Phase B3 — Pages / intake / social (2–3 days, ref `docs/02 §2.6`, `docs/04 §4.6`)

- [x] B3.0 Models + migration `b3-pages-intake-social`: Page(+tree)/PageVersion/ProjectPage/PageLabel; Intake(+IntakeIssue triage statuses); Notification/Sticky/DraftIssue(+Assignee/Label)/RecentVisit (intake-name partial unique deferred to B5)
- [x] B3.1 Pages (`apps/backend/src/modules/pages/`): CRUD + tree parent + TipTap description GET|PATCH (version snapshot, cap-20 retention) + versions list/get/restore + access + lock/unlock (owner bypass) + archive/restore + duplicate + move + favorites; snake_case TPage shape (label/project ids, is_favorite)
  - Verified by curl: create→2 description edits→2 versions, lock blocks non-owner (owner bypass by design), duplicate copy, archive flag
- [x] B3.2 Intake (`apps/backend/src/modules/intake/`): intakes CRUD + inbox-issues triage (numeric statuses -2..2 per web enum; default pending+snoozed-due queue; create spawns triage-state issue; accept→default state; decline/snooze/duplicate; issue sub-edit; delete removes link+issue)
  - Verified by curl: create ENG-5 pending, hidden from normal list, accept→visible with state, decline→queue empty; fixed whitelist-stripped `issue` field + null-safe DTOs
- [x] B3.3 Social (`apps/backend/src/modules/social/`): notifications list/unread/read/archive/mark-all-read/delete (=archive) + notify() helper for B4 fanout; stickies CRUD (owner-scoped); drafts CRUD + draft-to-issue promotion (copies fields, retires draft); recent-visits list/track (UUID-tolerant, cap-50)
  - Verified by curl: sticky round-trip, draft→promoted ENG-7, notif list/unread/read/archive, recents incl. bad-id tolerance
- [x] B3.4 Verify: pages edit+versions, triage creates+accepts issues, bell flows — all API-verified; web Pages/Intake UI pending human pass
- [x] Exit: docs + triage + notifications live next to work

## Phase B4 — Files / export / webhooks / tokens / crons (2 days, ref `docs/03 §3.6-3.7`, `docs/04 §4.6`)

- [x] B4.1 Files: `FileAsset` local upload + meta, `FILE_SIZE_LIMIT=5MB` (done in B1 assets module; orphan GC lands in B4.5) + ops models migration `b4-ops-models` (ExporterHistory/Webhook/WebhookLog/APIToken/APIActivityLog)
- [x] B4.2 Export: `ExporterHistory{workspace,projectIds[],provider csv|xlsx|json,token}`; `POST /export-issues/` (synchronous build at internal scale, 7d token URL) + `GET` history + `GET /api/exports/:token/download/` (404/410 handling); `purgeExpired()` ready for the B4.5 cron
  - Verified by curl: csv (ENG keys, states, labels), json (6 rows), xlsx (7KB), history (3), bad token 404
- [x] B4.3 Webhooks (`apps/backend/src/modules/webhooks/`): CRUD (unique workspace/url, http/https, SSRF guard blocks localhost/private ranges with `WEBHOOK_ALLOW_PRIVATE=1` dev escape), regenerate (new `plane_wh_*`), secret hidden unless `?show_secret_key=true`, fire-and-forget HMAC fanout (`x-plane-signature`, 5s timeout, 1 retry) on issue/project/cycle/module events, WebhookLog rows + purgeLogs(30d)
  - Verified by curl: local catcher received `issue.created` + valid sig + payload (ENG-8), log row 200, secret hidden by default, regenerate rotates, localhost 400 when guard on
- [x] B4.4 Tokens (`apps/backend/src/modules/apitokens/`): `GET|POST|DELETE /api/users/api-tokens/` (`plane_api_*` full value shown once at create), SessionAuthGuard accepts `X-Api-Token` (validates isActive/expiry, stamps lastUsed, writes APIActivityLog); 60/min limit TODO with rate-limit pack in B5
  - Verified by curl: create→list, API call via token (no cookie), bad token 401, deleted token 401, DB-expired token 401 (note: `expires_in_days:0` = no expiry by falsy design)
- [x] B4.5 Crons (`apps/backend/src/modules/crons/`): `*/5 * * * *` notify fanout stub (SMTP-gated TODO), hourly GC (orphan assets >24h, disk sweep vs FileAsset rows, webhook logs >30d, expired exports), `0 0 * * *` hard-delete (issues→pages/cycles/modules/projects/workspaces past HARD_DELETE_AFTER_DAYS), `0 1 * * *` archive_and_close (archiveIn→archivedAt, closeIn→cancel/default state)
- [x] B4.6 Stubs: `GET /api/instances/` (done in B0), `GET /api/timezones/` (13 zones, TTimezones shape), `GET /health`
- [x] B4.7 Verify: attachments (B1), export csv/json/xlsx downloads (B4.2), webhook delivery + log row, token auth incl. expiry — all green; backend moved to `:4040` per owner (8000 stays free)
- [x] Exit: ops surface complete for v1

## Phase B5 — Harden + ship (1–2 days, ref `docs/00 §0.7`, `AGENT.md §7-8`)

- [x] B5.1 Guards audit: non-member 403, ws-ADMIN bypass 200 (re-verified after w2 rejoin), inactive user 401, 401 shape `{detail}` (web interceptor compatible); GUEST read / MEMBER write / ADMIN delete enforced per module; invite re-send fixed (refresh existing row instead of P2002 500; join reactivates membership)
- [x] B5.2 DB: partial uniques + pg_trgm migration `20260907141000_b5_partial_uniques` (projects identifier/name, states, intakes, issues project+sequence, webhooks url; gin trgm on issues/projects names); serializers emit snake_case directly (no interceptor needed); list endpoints share the TIssuesResponse cursor envelope
- [x] B5.3 Prod: backend `Dockerfile` (B0) + root compose `db + backend:4040 + web:3000` (uploads/exports volumes, ADMIN_EMAILS env); `ADMIN_EMAILS`/`ADMIN_INITIAL_PASSWORD` superadmin seed in `prisma/seed.ts` (verified: admin created + ensured); `README.md` runbook (dev/prod/backup/health)
- [x] B5.4 Quality: backend `check:types + check:lint (0 warnings) + test (passWithNoTests) + build` green; web `check:types + check:lint` green; smoke E2E on :4040 green — register→signin redirect→workspace→project (SMK)→ENG-1→board drag (state+sort persisted)→cycle (progress 1/started 1)→module (in-progress, progress)→page (1 version)→intake create+accept→visible→csv export (2 rows)
- [x] B5.5 Docs: TODOS ticked; docs/04 base URL updated to :4040 + shipped-endpoints note; README runbook added; `PLAN.md` not re-created (TODOS.md + AGENT.md are the live plan)
- [x] Exit: internal URL (:4040 backend / :3000 web) + onboarding runbook

## Phase 6 — Optional hardening (carried out of B5)

- [x] 6.1 API-token rate limit: `parseRateLimit("60/minute")` util; SessionAuthGuard token path returns 429 `{detail}` after limit; `API_KEY_RATE_LIMIT` env in .env.example
  - Verified by curl: 70 rapid calls → exactly 60×200 + 10×429
- [ ] 6.2 SMTP delivery (Nodemailer, SMTP_* gated): magic codes, password reset links, workspace/project invitations, notification digest cron (marks `data.emailDigestSent`); dev fallback stays (code/token in response when AUTH_RETURN_CODES_DEV)
- [ ] 6.3 Web UI click-through: script every API call the web makes on app boot + key pages (sign-in, workspace home, project issues/board/cycles/modules/pages/intake) against :4040; fix any 4xx/5xx; human visual pass recommended afterwards

## Out of scope (do not build, do not tick)

AI agent, AI APIs, LLM/summaries/embeddings/vectors, OpenSearch, RabbitMQ/Celery/Beat, BullMQ/Redis-required queues, MinIO cluster, SSO/SAML, `apps/live` Hocuspocus collab, license/monitor/silo server, `apps/admin|space` promote (parked).

## How to use this file

1. Work top-down 0 → B5, one checkbox group per change.
2. Before coding a group, read its `docs/` refs + `apps/web/core/services/<domain>*` shapes.
3. After each group: run `backend typecheck+test` + `web check:types`; tick boxes here in same commit.
4. If endpoint shape changes, update `docs/04-api-contracts.md` first.
