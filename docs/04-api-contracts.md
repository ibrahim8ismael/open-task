# 04 — API Contracts (TS backend must satisfy `apps/web`, no AI routes)

> Base: `VITE_API_BASE_URL` (**`http://localhost:4040`** in this repo) + `withCredentials:true` (cookie) or `X-Api-Token: plane_api_*`. Prefix `/api/...`, auth under `/auth/...`. Trailing slash compatible (`/path/` and `/path`). AI endpoints omitted.
>
> Shipped beyond the list below (B1.6/B2/B3 gap batches): `GET /projects/details/`, `GET /project-stats/`, project `user-properties` GET|PATCH, `members/me`, `search-issues`, `user-favorite-projects`, project-invite accept, `active-cycles`, issue `remove-relation`, `attachments v2` register/upload/serve, archived/deleted lists, `bulk-*` issues, comments + reactions, links, versions/history/meta, inbox-issues triage (numeric status -2..2), notifications, stickies, draft-issues + draft-to-issue, recent-visits, webhooks (+logs/regenerate), export-issues + token downloads, api-tokens, timezones.

## 4.1 Auth `/auth/*` (form-POST compatible, JSON responses)

```
POST /auth/sign-in {email,password} -> set session cookie + {user}
POST /auth/sign-up {email,password,displayName?}
POST /auth/sign-out -> clear cookie
POST /auth/email-check {email} -> {exists}
POST /auth/magic-generate {email} -> 200 (SMTP code)
POST /auth/magic-sign-in {email,code}
POST /auth/forgot-password {email}
POST /auth/reset-password/:uid/:token {password}
POST /auth/change-password {old,new} (auth)
POST /auth/set-password {password} (auth, first-time)
GET  /auth/get-csrf-token/ -> {csrf_token}
GET  /auth/google|github (+ /callback?code=) -> provision + redirect WEB_BASE_URL
```

Spaces duplicate (`/auth/spaces/*`) — stub to same handlers in v1.

## 4.2 Workspace

```
GET|POST /api/workspaces/ | list mine, create {name,slug?}
GET|PUT|PATCH|DELETE /api/workspaces/:slug/
GET /api/workspace-slug-check/?slug= -> {available}
GET|POST /api/workspaces/:slug/invitations/ | POST /:id/join
GET|PATCH|DELETE /api/workspaces/:slug/members/:id | POST /leave
GET /api/users/last-visited-workspace/ | PUT (set Profile.lastWorkspaceId)
GET|PUT /api/workspaces/:slug/user-properties/ (filters)
```

## 4.3 Project

```
GET|POST /api/workspaces/:slug/projects/
GET /api/workspaces/:slug/projects/:id/details/
GET|PUT|PATCH|DELETE /api/workspaces/:slug/projects/:id/
POST /api/workspaces/:slug/projects/:id/archive | /unarchive
GET|POST /api/workspaces/:slug/projects/:id/members/ | PATCH|DELETE /:memberId
GET|POST /api/workspaces/:slug/projects/:id/invitations/
GET /api/workspaces/:slug/project-identifiers/
GET|POST /api/users/me/workspaces/:slug/projects/invitations
```

## 4.4 Issue (core — keep shapes exact)

```
GET|POST /api/workspaces/:slug/projects/:pid/issues/
POST /api/workspaces/:slug/projects/:pid/issues/list/ {filters} -> filtered list
GET /api/workspaces/:slug/projects/:pid/issues/:id/
PUT|PATCH|DELETE /.../issues/:id/
GET /api/workspaces/:slug/work-items/:IDENT-:SEQ/ (ENG-123 lookup)
POST /.../issues/bulk-delete-issues | /bulk-archive-issues
GET /.../issues/archived-issues | /deleted-issues
POST /.../issues/:id/archive | /unarchive
GET|POST /.../issues/:id/sub-issues/ | /issue-links/ | /issue-attachments/ | /comments/ | /reactions/ | /history | /subscribe | /issue-relation | /meta | /versions
```

Issue JSON (web expects): `{id, sequence_id, name, description_json/html, priority, state, estimate_point, type, parent, assignees[], labels[], start_date, target_date, sort_order, completed_at, archived_at, project, workspace, created_by/updated_by}` — snake_case on wire (keep Django casing for compat, map in Prisma service).

## 4.5 Cycle / module / taxonomy

```
GET|POST /api/workspaces/:slug/projects/:pid/cycles/
GET|PUT|PATCH|DELETE /.../cycles/:id/ + /cycle-issues/ + /transfer-issues {new_cycle_id} + /progress + /archive + /user-properties
GET /.../archived-cycles/ | /cycles/date-check/
# modules mirror:
GET|POST /.../modules/ | GET|PUT|PATCH|DELETE /.../modules/:mid/ + /issues/ + /module-links/ + /archive
GET|POST /.../states/ | PATCH|DELETE /.../states/:id/ | POST /:id/mark-default/
GET|POST /.../labels/ | .../estimates/ (+ /:eid/points) | .../issue-types/
```

## 4.6 Views / pages / intake / misc

```
GET|POST /api/workspaces/:slug/projects/:pid/views/ | .../:vid/ (+ /lock)
GET|POST /api/workspaces/:slug/projects/:pid/pages/ | .../:pageId/ (+ /versions, /lock, /share)
GET|POST /api/workspaces/:slug/projects/:pid/intakes/ | .../intake-issues/ (+ /:id/accept|reject|snooze)
GET /api/workspaces/:slug/notifications/ | POST /:id/read | /archive
GET|POST /api/workspaces/:slug/user-favorites/ | /stickies/ | /draft-issues/ | /recent-visits/
GET|POST /api/assets/ (upload meta) | GET /api/assets/:id
POST|GET /api/workspaces/:slug/export-issues/ {provider:csv|xlsx|json}
GET|POST /api/workspaces/:slug/webhooks/ | .../:id/ | POST /:id/regenerate/ | GET /webhook-logs/:webhookId/
GET|POST /api/users/api-tokens/ | DELETE /:id
GET /api/instances/ -> {config} stub
GET /api/timezones/ | GET /api/search/?q= (ILIKE v1)
```

Errors: `{detail|error: string, field_errors?: {}}` with 400/401/403/404/429. Pagination: `{results[], next_cursor?, count}` — support `?per_page&cursor`.

Auth on all `/api/*`: session cookie OR `X-Api-Token`, else 401 → web interceptor redirects `/?next_path=<path>`.
