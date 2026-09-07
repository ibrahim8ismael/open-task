# 06 — Frontend Pages & Routes

All three frontend apps are React Router v7 (framework mode) apps. Route configs live in:

* `apps/web/app/routes.ts` → pulls from `app/routes/core.ts` + `app/routes/extended.ts` (empty), wrapped in a pathless `./layout.tsx` shell, with a `*` catch-all → `not-found.tsx`
* `apps/admin/app/routes.ts` — inline config
* `apps/space/app/routes.ts` — inline config

`:param` = dynamic segment. `index` = app root page.

---

## 1. `apps/web` — Main App (client-side SPA)

Source: `apps/web/app/routes/core.ts` (405 lines). `extended.ts` is currently empty.

### 1.1 Auth / Account / Onboarding (top-level)

| Route | Page |
|---|---|
| `/` (index) | `(home)/page.tsx` — Sign In (home) |
| `/sign-up` | `(all)/sign-up/page.tsx` |
| `/accounts/forgot-password` | `(all)/accounts/forgot-password/page.tsx` |
| `/accounts/reset-password` | `(all)/accounts/reset-password/page.tsx` |
| `/accounts/set-password` | `(all)/accounts/set-password/page.tsx` |
| `/create-workspace` | `(all)/create-workspace/page.tsx` |
| `/onboarding` | `(all)/onboarding/page.tsx` |
| `/invitations` | `(all)/invitations/page.tsx` |
| `/workspace-invitations` | `(all)/workspace-invitations/page.tsx` |
| `/settings/profile/:profileTabId` | `(all)/settings/profile/[profileTabId]/page.tsx` — Profile settings (standalone) |

### 1.2 Workspace-level (`(all)/[workspaceSlug]/(projects)`)

| Route | Page |
|---|---|
| `/:workspaceSlug` | `(projects)/page.tsx` — Workspace home |
| `/:workspaceSlug/active-cycles` | `active-cycles/page.tsx` |
| `/:workspaceSlug/analytics/:tabId` | `analytics/[tabId]/page.tsx` |
| `/:workspaceSlug/browse/:workItem` | `browse/[workItem]/page.tsx` |
| `/:workspaceSlug/drafts` | `drafts/page.tsx` |
| `/:workspaceSlug/notifications` | `notifications/page.tsx` |
| `/:workspaceSlug/profile/:userId` | `profile/[userId]/page.tsx` |
| `/:workspaceSlug/profile/:userId/:profileViewId` | `profile/[userId]/[profileViewId]/page.tsx` |
| `/:workspaceSlug/profile/:userId/activity` | `profile/[userId]/activity/page.tsx` |
| `/:workspaceSlug/stickies` | `stickies/page.tsx` |
| `/:workspaceSlug/workspace-views` | `workspace-views/page.tsx` |
| `/:workspaceSlug/workspace-views/:globalViewId` | `workspace-views/[globalViewId]/page.tsx` |
| `/:workspaceSlug/projects` | `projects/(list)/page.tsx` — Project list |
| `/:workspaceSlug/projects/archives` | `projects/(detail)/archives/page.tsx` — Archived projects |

### 1.3 Project-level (`(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]`)

| Route | Page |
|---|---|
| `/:workspaceSlug/projects/:projectId/issues` | `issues/(list)/page.tsx` |
| `/:workspaceSlug/projects/:projectId/issues/:issueId` | `issues/(detail)/[issueId]/page.tsx` |
| `/:workspaceSlug/projects/:projectId/cycles` | `cycles/(list)/page.tsx` |
| `/:workspaceSlug/projects/:projectId/cycles/:cycleId` | `cycles/(detail)/[cycleId]/page.tsx` |
| `/:workspaceSlug/projects/:projectId/modules` | `modules/(list)/page.tsx` |
| `/:workspaceSlug/projects/:projectId/modules/:moduleId` | `modules/(detail)/[moduleId]/page.tsx` |
| `/:workspaceSlug/projects/:projectId/views` | `views/(list)/page.tsx` |
| `/:workspaceSlug/projects/:projectId/views/:viewId` | `views/(detail)/[viewId]/page.tsx` |
| `/:workspaceSlug/projects/:projectId/pages` | `pages/(list)/page.tsx` |
| `/:workspaceSlug/projects/:projectId/pages/:pageId` | `pages/(detail)/[pageId]/page.tsx` |
| `/:workspaceSlug/projects/:projectId/intake` | `intake/page.tsx` |
| `/:workspaceSlug/projects/:projectId/archives/issues` | `archives/issues/(list)/page.tsx` |
| `/:workspaceSlug/projects/:projectId/archives/issues/:archivedIssueId` | `archives/issues/(detail)/[archivedIssueId]/page.tsx` |
| `/:workspaceSlug/projects/:projectId/archives/cycles` | `archives/cycles/page.tsx` |
| `/:workspaceSlug/projects/:projectId/archives/modules` | `archives/modules/page.tsx` |

### 1.4 Workspace Settings (`(all)/[workspaceSlug]/(settings)/settings/(workspace)`)

| Route | Page |
|---|---|
| `/:workspaceSlug/settings` | `(workspace)/page.tsx` — Workspace settings home (General) |
| `/:workspaceSlug/settings/members` | `(workspace)/members/page.tsx` |
| `/:workspaceSlug/settings/billing` | `(workspace)/billing/page.tsx` |
| `/:workspaceSlug/settings/exports` | `(workspace)/exports/page.tsx` |
| `/:workspaceSlug/settings/webhooks` | `(workspace)/webhooks/page.tsx` |
| `/:workspaceSlug/settings/webhooks/:webhookId` | `(workspace)/webhooks/[webhookId]/page.tsx` |

### 1.5 Project Settings (`(all)/[workspaceSlug]/(settings)/settings/projects`)

| Route | Page |
|---|---|
| `/:workspaceSlug/settings/projects` | `projects/page.tsx` — No-projects-available page |
| `/:workspaceSlug/settings/projects/:projectId` | `projects/[projectId]/page.tsx` — Project settings home (General) |
| `/:workspaceSlug/settings/projects/:projectId/members` | `[projectId]/members/page.tsx` |
| `/:workspaceSlug/settings/projects/:projectId/features/cycles` | `[projectId]/features/cycles/page.tsx` |
| `/:workspaceSlug/settings/projects/:projectId/features/modules` | `[projectId]/features/modules/page.tsx` |
| `/:workspaceSlug/settings/projects/:projectId/features/views` | `[projectId]/features/views/page.tsx` |
| `/:workspaceSlug/settings/projects/:projectId/features/pages` | `[projectId]/features/pages/page.tsx` |
| `/:workspaceSlug/settings/projects/:projectId/features/intake` | `[projectId]/features/intake/page.tsx` |
| `/:workspaceSlug/settings/projects/:projectId/states` | `[projectId]/states/page.tsx` |
| `/:workspaceSlug/settings/projects/:projectId/labels` | `[projectId]/labels/page.tsx` |
| `/:workspaceSlug/settings/projects/:projectId/estimates` | `[projectId]/estimates/page.tsx` |
| `/:workspaceSlug/settings/projects/:projectId/automations` | `[projectId]/automations/page.tsx` |

### 1.6 Redirect Routes (legacy URL compat, `app/routes/redirects/core/`)

| Route | Redirects to |
|---|---|
| `/:workspaceSlug/projects/:projectId/settings/*` | → `/:workspaceSlug/settings/projects/:projectId/*` |
| `/:workspaceSlug/analytics` | → `/:workspaceSlug/analytics/overview` |
| `/:workspaceSlug/settings/api-tokens` | → `/settings/profile/api-tokens` |
| `/:workspaceSlug/projects/:projectId/inbox` | → `/:workspaceSlug/projects/:projectId/intake` |
| `/accounts/sign-up` | → sign-up |
| `/sign-in`, `/signin`, `/login` | → `/` (home / sign-in) |
| `/register` | → sign-up |
| `/profile/*` | → profile settings |
| `/:workspaceSlug/settings/account/*` | → profile settings |
| `*` (catch-all, last) | `app/not-found.tsx` (404) |

---

## 2. `apps/admin` — Admin Dashboard

Source: `apps/admin/app/routes.ts` (27 lines).

| Route | Page |
|---|---|
| `/` (index) | `(all)/(home)/page.tsx` — Admin login/home |
| `/general` | `(dashboard)/general/page.tsx` |
| `/workspace` | `(dashboard)/workspace/page.tsx` |
| `/workspace/create` | `(dashboard)/workspace/create/page.tsx` |
| `/email` | `(dashboard)/email/page.tsx` |
| `/authentication` | `(dashboard)/authentication/page.tsx` |
| `/authentication/github` | `(dashboard)/authentication/github/page.tsx` |
| `/authentication/gitlab` | `(dashboard)/authentication/gitlab/page.tsx` |
| `/authentication/google` | `(dashboard)/authentication/google/page.tsx` |
| `/authentication/gitea` | `(dashboard)/authentication/gitea/page.tsx` |
| `/ai` | `(dashboard)/ai/page.tsx` |
| `/image` | `(dashboard)/image/page.tsx` |
| `*` (catch-all, last) | `components/404.tsx` (404) |

---

## 3. `apps/space` — Public Site

Source: `apps/space/app/routes.ts` (16 lines).

| Route | Page |
|---|---|
| `/` (index) | `app/page.tsx` — Space home |
| `/:workspaceSlug/:projectId` | `[workspaceSlug]/[projectId]/page.tsx` — Public project |
| `/issues/:anchor` | `issues/[anchor]/page.tsx` — Public issue by anchor |
| `*` (catch-all, last) | `not-found.tsx` (404) |

---

## Notes

* `(group)` directories are route groups — they do NOT appear in the URL, they only group layouts.
* Every page file is `page.tsx` inside its feature directory; layouts are `layout.tsx`.
* Counts (`page.tsx` files on disk): `apps/web` = 58, `apps/admin` = 12, `apps/space` = 3 (Space renders 404 via `not-found.tsx`, not a `page.tsx`).
* Out of scope (per repo constraints): AI-related pages (`pages/ai`, AI search/summaries) — not part of rebuild.
