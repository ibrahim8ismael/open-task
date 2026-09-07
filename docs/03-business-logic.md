# 03 — Business Logic (ported from Django, TS rules, no AI)

> Extracted from `plane/db/models/*`, `mixins.py`, `bgtasks/*`, `permissions/*`. AI tasks excluded.

## 3.1 Issue numbering `ENG-123`

* `Project.identifier` uppercased/trimmed on save, unique per `(identifier, workspace)` partial.
* On `Issue.create` only (in TX): lock per project (`pg_advisory_xact_lock(hash(projectId))` → Prisma: `transaction + SELECT ... FOR UPDATE` on `ProjectIdentifier` row), `MAX(sequence)` → `sequenceId = max+1 else 1`, create `IssueSequence{issue, project, sequence}`. Never reuse on delete (row stays, `deleted=true`).
* `sortOrder = MAX(sortOrder WHERE project+state)+10000`, default `65535`.
* Default state: if `stateId==null` assign `State WHERE project+isDefault+!isTriage` else first non-triage.
* Display key = `identifier-sequenceId`. Lookup: split `IDENT-SEQ`, find `Project WHERE identifier ILIKE + workspaceSlug`, membership check, `Issue WHERE sequenceId=SEQ`.

## 3.2 `completedAt` sync

* On `issue.update` where `stateId` changed: fetch new `State.group`; if `completed` → `completedAt=now()` else `completedAt=null`.
* `StateGroup`: `backlog|unstarted|started|completed|cancelled|triage`. Seed per project: Backlog(default)/Todo/In Progress/Done/Cancelled/Triage.
* Default list scope excludes: `state.group=triage`, `archivedAt NOT NULL`, `project.archivedAt NOT NULL`, `isDraft=true`. Implement as Prisma `where` helper `issueVisible()`.

## 3.3 Cycle / module progress

* `Cycle{name, start/end, ownedBy, progressSnapshot={}, archivedAt, timezone, version}` + `CycleIssue(cycle,issue)` unique pair. Same for `Module{status, lead}` + `ModuleIssue` + `ModuleMember`.
* New cycle `sortOrder = MIN(sortOrder)-10000`.
* Block edits if `cycle.endDate` passed (return 400 `cycle closed`).
* `GET progress`: live counts by `state.group` + estimate sums; if `progressSnapshot` non-empty (after transfer/close) return snapshot.
* `POST transfer-issues {newCycleId}`: move incomplete issues, freeze old `progressSnapshot{total,backlog,unstarted,started,completed,cancelled,distribution,estimates}`.
* Archive = set `archivedAt`, separate `/archived-*` lists.

## 3.4 Soft-delete + archive (not the same)

* `deletedAt` soft-delete: `DELETE` endpoints set `deletedAt=now()` + cascade soft-delete (relations with `Cascade` → soft-delete recursively, `SetNull` → nullify, `DoNothing` → skip e.g. `IssueActivity.issue`).
* Uniqueness always partial `WHERE deletedAt IS NULL`.
* Hard-delete cron daily: `WHERE deletedAt < now - HARD_DELETE_DAYS` hard-delete. Workspace delete rewrites `slug+timestamp`.
* Archive ≠ delete: `Issue.archivedAt (date)`, `Cycle/Module/Project/Page/View.archivedAt`; filtered from defaults, separate archive lists + `archive/unarchive` actions.

## 3.5 Roles + permissions (for TS guards)

* Roles `ADMIN=20 | MEMBER=15 | GUEST=5` on both `WorkspaceMember` and `ProjectMember` (+ `isActive` required).
* Rule: workspace-level checks `WorkspaceMember`; project-level checks `ProjectMember` + escape hatch workspace `ADMIN` bypasses. `createdBy` owner allowed if `creator=true`.
* Map to guards:
  * `ProjectEntity`: GET any project member; write ADMIN|MEMBER
  * `ProjectAdmin`: ADMIN only
  * `ProjectLite`: any member incl. GUEST
  * `WorkspaceEntity`: GET member; write ADMIN|MEMBER
  * `WorkspaceBase`: POST open (create), PUT/PATCH ADMIN|MEMBER, DELETE ADMIN only

## 3.6 Background rules (no Celery — use node-cron)

* `*/5 * * * *` notification fanout stub (create `Notification` rows + optional SMTP).
* Daily `00:00` hard-delete + retention: `api_logs`, `email_logs`, `page_versions>20/page`, `issue_versions>20/issue`, `webhook_logs`.
* Daily `01:00` archive_and_close:
  * if `project.archiveIn>0`: `Issue WHERE state.group IN (completed,cancelled) AND updatedAt<=now-archiveIn*30d AND (no active cycle/module or ended)` → `archivedAt=today` + activity log
  * if `project.closeIn>0`: stale `backlog|unstarted|started` → move to `project.defaultState ?? first cancelled`
* Export: `POST export {provider:csv|xlsx|json, projectIds}` → row `ExporterHistory{token}` → async build zip → file URL (7d) → `GET` paginated `?per_page&cursor`. GC expired.
* Webhook: `POST HMAC(secretKey) JSON`, retries, `WebhookLog{event,req/resp,retry}`. URL must be http/https, no localhost. Secret hidden unless `?show_secret` / regenerate.

## 3.7 File + version rules

* `FILE_SIZE_LIMIT=5MB`. Orphan assets (`isUploaded=false` older than 24h) GC daily 02:00.
* `IssueVersion` snapshot on every update; `PageVersion` cap 20/page.
* `IssueActivity` central audit: every mutation writes `{verb, field, old/new, actor}` + fanout notifications/webhooks (call `issueActivity()` helper, not scattered writes).
