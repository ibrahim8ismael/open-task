# 02 — Database Schema (Prisma + Postgres, ported from Django, no AI)

> Port of `plane-so/apps/api/plane/db/models/*.py` (base, workspace, project, issue, cycle, module, state, label, estimate, issue_type, view, page, intake, notification, favorite, sticky, draft, user, asset, webhook, api, session). AI tables excluded.

## 2.1 Conventions

```prisma
// Prisma 7: datasource url lives in apps/backend/prisma.config.ts, NOT in schema.
// Client requires a driver adapter: new PrismaPg({ connectionString }) from @prisma/adapter-pg.
datasource db { provider = "postgresql" }
generator client { provider = "prisma-client-js" }

// Every table except User/Profile/Account/Session:
id        String   @id @default(uuid()) @db.Uuid
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
createdBy String?  @db.Uuid
updatedBy String?  @db.Uuid
deletedAt DateTime?
// All @@unique below are partial WHERE deletedAt IS NULL -> implement in migration:
// CREATE UNIQUE INDEX ... WHERE "deletedAt" IS NULL
```

Enums:

```prisma
enum Role { ADMIN MEMBER GUEST } // map 20/15/5 in code
enum Priority { urgent high medium low none }
enum StateGroup { backlog unstarted started completed cancelled triage }
enum ModuleStatus { backlog planned in_progress paused completed cancelled }
enum EstimateType { categories points }
enum IssueRelationType { duplicate relates_to blocked_by start_before finish_before implemented_by }
enum Network { Secret Public }
enum IntakeStatus { Pending Rejected Snoozed Accepted Duplicate } // -2..2
```

## 2.2 Identity + workspaces

```prisma
model User {
  id String @id @default(uuid()) @db.Uuid
  username String @unique
  email String? @unique
  displayName String @default("")
  firstName String @default("")
  lastName String @default("")
  avatar String @default("")
  coverImage String?
  passwordHash String @default("") // new: Django used unusable pw for OAuth; we store bcrypt
  isActive Boolean @default(true)
  isSuperuser Boolean @default(false)
  isBot Boolean @default(false)
  botType String?
  userTimezone String @default("UTC")
  lastActive DateTime?
  avatarAssetId String? @db.Uuid
  avatarAsset FileAsset? @relation("UserAvatar", fields: [avatarAssetId], references: [id], onDelete: SetNull)
  coverImageAssetId String? @db.Uuid
  coverImageAsset FileAsset? @relation("UserCover", fields: [coverImageAssetId], references: [id], onDelete: SetNull)
  profile Profile?
  accounts Account[]
  @@map("users")
}

model Profile {
  id String @id @default(uuid()) @db.Uuid
  userId String @unique @db.Uuid
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  language String @default("en")
  theme Json @default("{}")
  isOnboarded Boolean @default(false)
  lastWorkspaceId String? @db.Uuid
  startOfWeek Int @default(0)
  @@map("profiles")
}

model Account {
  id String @id @default(uuid()) @db.Uuid
  userId String @db.Uuid
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider String // google|github|gitlab
  providerAccountId String
  accessToken String
  refreshToken String?
  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  sessionKey String @id
  sessionData String
  expireAt DateTime
  deviceInfo Json?
  userId String?
  @@index([userId])
  @@map("sessions")
}

model Workspace {
  id String @id @default(uuid()) @db.Uuid
  name String
  slug String @unique // rename slug+epoch on soft-delete in code
  organizationSize String?
  timezone String @default("UTC")
  backgroundColor String @default("#ffffff")
  ownerId String @db.Uuid
  logoAssetId String? @db.Uuid
  logoAsset FileAsset? @relation(fields: [logoAssetId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  members WorkspaceMember[]
  projects Project[]
  @@map("workspaces")
}

model WorkspaceMember {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  memberId String @db.Uuid
  role Role @default(MEMBER) // ADMIN=20 MEMBER=15 GUEST=5
  isActive Boolean @default(true)
  viewProps Json @default("{}")
  issueProps Json @default("{\"subscribed\":true}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@unique([workspaceId, memberId]) // partial in migration
  @@map("workspace_members")
}

model WorkspaceMemberInvite {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  email String
  accepted Boolean @default(false)
  token String
  role Role @default(MEMBER)
  respondedAt DateTime?
  createdAt DateTime @default(now())
  @@unique([email, workspaceId])
  @@map("workspace_member_invites")
}

model Team { // keep minimal; used for grouping
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  name String
  description String @default("")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@unique([name, workspaceId])
  @@map("teams")
}

model WorkspaceUserProperties {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  userId String @db.Uuid
  filters Json @default("{}")
  displayFilters Json @default("{}")
  displayProperties Json @default("{}")
  @@unique([workspaceId, userId])
  @@map("workspace_user_properties")
}
```

## 2.3 Projects + taxonomy

```prisma
model Project {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  name String
  identifier String // uppercased ENG, unique per workspace
  description String @default("")
  network Network @default(Public)
  emoji String?
  coverImage String?
  archiveIn Int @default(0)
  closeIn Int @default(0)
  moduleView Boolean @default(false)
  cycleView Boolean @default(false)
  issueViewsView Boolean @default(false)
  pageView Boolean @default(true)
  intakeView Boolean @default(false)
  isTimeTracking Boolean @default(false)
  archivedAt DateTime?
  timezone String @default("UTC")
  defaultStateId String? @db.Uuid
  defaultState State? @relation("ProjectDefaultState", fields: [defaultStateId], references: [id], onDelete: SetNull)
  estimateId String? @db.Uuid
  estimate Estimate? @relation(fields: [estimateId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@unique([identifier, workspaceId]) // partial
  @@unique([name, workspaceId])       // partial
  @@map("projects")
}

model ProjectMember {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  memberId String? @db.Uuid
  role Role @default(MEMBER)
  isActive Boolean @default(true)
  sortOrder Float @default(65535)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@unique([projectId, memberId])
  @@map("project_members")
}

model ProjectMemberInvite {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  email String
  accepted Boolean @default(false)
  token String
  role Role @default(MEMBER)
  @@map("project_member_invites")
}

model ProjectIdentifier { // display counter guard
  id Int @id @default(autoincrement())
  workspaceId String? @db.Uuid
  projectId String @unique @db.Uuid
  name String // upper identifier
  @@unique([name, workspaceId])
  @@map("project_identifiers")
}

model State {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  name String
  description String @default("")
  color String @default("#808080")
  group StateGroup @default(backlog)
  sequence Float @default(65535)
  isDefault Boolean @default(false)
  isTriage Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@unique([name, projectId])
  @@map("states")
}

model Label {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  projectId String? @db.Uuid
  parentId String? @db.Uuid
  parent Label? @relation("LabelTree", fields: [parentId], references: [id], onDelete: Cascade)
  children Label[] @relation("LabelTree")
  name String
  description String @default("")
  color String @default("")
  sortOrder Float @default(65535)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@map("labels") // partial uniques in migration: (name) where project null, (projectId,name) where not null
}

model Estimate {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  name String
  type EstimateType @default(categories)
  lastUsed Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  points EstimatePoint[]
  @@unique([name, projectId])
  @@map("estimates")
}

model EstimatePoint {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  estimateId String @db.Uuid
  estimate Estimate @relation(fields: [estimateId], references: [id], onDelete: Cascade)
  key Int @default(0)
  value String @default("")
  description String @default("")
  @@map("estimate_points")
}

model IssueType {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  name String
  description String @default("")
  isEpic Boolean @default(false)
  isDefault Boolean @default(false)
  isActive Boolean @default(true)
  level Float @default(0)
  @@map("issue_types")
}

model ProjectIssueType {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  issueTypeId String @db.Uuid
  level Int @default(0)
  isDefault Boolean @default(false)
  @@unique([projectId, issueTypeId])
  @@map("project_issue_types")
}
```

## 2.4 Issues (core)

```prisma
model Issue {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  parentId String? @db.Uuid
  parent Issue? @relation("IssueTree", fields: [parentId], references: [id], onDelete: Cascade)
  children Issue[] @relation("IssueTree")
  stateId String? @db.Uuid
  typeId String? @db.Uuid
  estimatePointId String? @db.Uuid
  estimatePoint EstimatePoint? @relation(fields: [estimatePointId], references: [id], onDelete: SetNull)
  name String @default("")
  descriptionJson Json @default("{}")
  descriptionHtml String @default("<p></p>")
  descriptionStripped String?
  priority Priority @default(none)
  startDate DateTime? @db.Date
  targetDate DateTime? @db.Date
  sequenceId Int @default(1) // ENG-123, assigned in TX, never reused
  sortOrder Float @default(65535)
  completedAt DateTime?
  archivedAt DateTime? @db.Date
  isDraft Boolean @default(false)
  point Int?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  assignees IssueAssignee[]
  labels IssueLabel[]
  @@index([projectId, sequenceId])
  @@index([projectId, stateId])
  @@map("issues")
}

model IssueSequence { // gap guard, never reused
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  issueId String? @unique @db.Uuid
  sequence BigInt @default(1)
  deleted Boolean @default(false)
  @@map("issue_sequences")
}

model IssueAssignee {
  issueId String @db.Uuid
  assigneeId String @db.Uuid
  @@id([issueId, assigneeId])
  @@map("issue_assignees")
}

model IssueLabel {
  issueId String @db.Uuid
  labelId String @db.Uuid
  @@id([issueId, labelId])
  @@map("issue_labels")
}

model IssueRelation {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  issueId String @db.Uuid
  relatedIssueId String @db.Uuid
  relationType IssueRelationType @default(blocked_by)
  @@unique([issueId, relatedIssueId])
  @@map("issue_relations")
}

model IssueBlocker {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  blockId String @db.Uuid
  blockedById String @db.Uuid
  @@map("issue_blockers")
}

model IssueComment {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  issueId String @db.Uuid
  parentId String? @db.Uuid
  actorId String? @db.Uuid
  commentJson Json @default("{}")
  commentHtml String @default("<p></p>")
  commentStripped String @default("")
  access String @default("INTERNAL")
  editedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@map("issue_comments")
}

model IssueAttachment {
  id String @id @default(uuid()) @db.Uuid
  issueId String @db.Uuid
  attributes Json @default("{}")
  asset String // file path
  createdAt DateTime @default(now())
  @@map("issue_attachments")
}

model IssueLink {
  id String @id @default(uuid()) @db.Uuid
  issueId String @db.Uuid
  title String?
  url String
  metadata Json @default("{}")
  @@map("issue_links")
}

model IssueActivity { // audit, never hard-cascade from issue
  id String @id @default(uuid()) @db.Uuid
  issueId String? @db.Uuid
  actorId String? @db.Uuid
  verb String @default("created")
  field String?
  oldValue String?
  newValue String?
  comment String @default("")
  createdAt DateTime @default(now())
  @@map("issue_activities")
}

model IssueSubscriber {
  issueId String @db.Uuid
  subscriberId String @db.Uuid
  @@id([issueId, subscriberId])
  @@map("issue_subscribers")
}

model IssueReaction {
  issueId String @db.Uuid
  actorId String @db.Uuid
  reaction String
  @@id([issueId, actorId, reaction])
  @@map("issue_reactions")
}

model CommentReaction {
  commentId String @db.Uuid
  actorId String @db.Uuid
  reaction String
  @@id([commentId, actorId, reaction])
  @@map("comment_reactions")
}

model IssueVote {
  issueId String @db.Uuid
  actorId String @db.Uuid
  vote Int @default(1)
  @@id([issueId, actorId])
  @@map("issue_votes")
}

model IssueVersion { // snapshot on change
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  issueId String @db.Uuid
  name String @default("")
  priority Priority @default(none)
  sequenceId Int @default(1)
  sortOrder Float @default(65535)
  completedAt DateTime?
  lastSavedAt DateTime @default(now())
  @@map("issue_versions")
}
```

## 2.5 Cycles + modules

```prisma
model Cycle {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  name String
  description String @default("")
  startDate DateTime?
  endDate DateTime?
  ownedById String @db.Uuid
  progressSnapshot Json @default("{}")
  sortOrder Float @default(65535)
  archivedAt DateTime?
  timezone String @default("UTC")
  version Int @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  issues CycleIssue[]
  @@map("cycles")
}

model CycleIssue {
  cycleId String @db.Uuid
  cycle Cycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  issueId String @db.Uuid
  @@id([cycleId, issueId])
  @@map("cycle_issues")
}

model Module {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  name String
  description String @default("")
  startDate DateTime? @db.Date
  targetDate DateTime? @db.Date
  status ModuleStatus @default(planned)
  leadId String? @db.Uuid
  sortOrder Float @default(65535)
  archivedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  members ModuleMember[]
  issues ModuleIssue[]
  @@unique([name, projectId])
  @@map("modules")
}

model ModuleMember {
  moduleId String @db.Uuid
  memberId String @db.Uuid
  @@id([moduleId, memberId])
  @@map("module_members")
}

model ModuleIssue {
  moduleId String @db.Uuid
  issueId String @db.Uuid
  @@id([moduleId, issueId])
  @@map("module_issues")
}

model ModuleLink {
  id String @id @default(uuid()) @db.Uuid
  moduleId String @db.Uuid
  title String?
  url String
  metadata Json @default("{}")
  @@map("module_links")
}
```

## 2.6 Views, pages, intake, misc

```prisma
model IssueView {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  projectId String? @db.Uuid
  ownedById String @db.Uuid
  name String
  description String @default("")
  query Json @default("{}")
  filters Json @default("{}")
  displayFilters Json @default("{}")
  displayProperties Json @default("{}")
  access Int @default(1) // 0 private 1 public
  sortOrder Float @default(65535)
  isLocked Boolean @default(false)
  archivedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@map("issue_views")
}

model Page {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  ownedById String @db.Uuid
  parentId String? @db.Uuid
  parent Page? @relation("PageTree", fields: [parentId], references: [id], onDelete: Cascade)
  children Page[] @relation("PageTree")
  name String @default("")
  descriptionJson Json @default("{}")
  descriptionHtml String @default("<p></p>")
  access Int @default(0)
  color String @default("")
  archivedAt DateTime? @db.Date
  isLocked Boolean @default(false)
  sortOrder Float @default(65535)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@map("pages")
}

model PageVersion {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  pageId String @db.Uuid
  ownedById String @db.Uuid
  descriptionJson Json @default("{}")
  descriptionHtml String @default("")
  lastSavedAt DateTime @default(now())
  @@map("page_versions") // retention: keep latest 20/page
}

model ProjectPage {
  projectId String @db.Uuid
  pageId String @db.Uuid
  workspaceId String @db.Uuid
  @@id([projectId, pageId])
  @@map("project_pages")
}

model Intake {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  name String
  description String @default("")
  isDefault Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@unique([name, projectId])
  @@map("intakes")
}

model IntakeIssue {
  id String @id @default(uuid()) @db.Uuid
  projectId String @db.Uuid
  workspaceId String @db.Uuid
  intakeId String @db.Uuid
  intake Intake @relation(fields: [intakeId], references: [id], onDelete: Cascade)
  issueId String @db.Uuid
  status IntakeStatus @default(Pending)
  snoozedTill DateTime?
  source String? @default("IN_APP")
  @@map("intake_issues")
}

model Notification {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  projectId String? @db.Uuid
  receiverId String @db.Uuid
  triggeredById String? @db.Uuid
  entityName String
  entityIdentifier String? @db.Uuid
  title String
  data Json?
  readAt DateTime?
  archivedAt DateTime?
  createdAt DateTime @default(now())
  @@index([receiverId, workspaceId, readAt, createdAt])
  @@map("notifications")
}

model UserFavorite {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  userId String @db.Uuid
  entityType String
  entityIdentifier String? @db.Uuid
  name String?
  parentId String? @db.Uuid
  sequence Float @default(65535)
  @@map("user_favorites")
}

model Sticky {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  ownerId String @db.Uuid
  name String?
  description Json @default("{}")
  color String?
  sortOrder Float @default(65535)
  createdAt DateTime @default(now())
  @@map("stickies")
}

model DraftIssue {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  projectId String? @db.Uuid
  parentId String? @db.Uuid
  stateId String? @db.Uuid
  name String?
  descriptionJson Json @default("{}")
  priority Priority @default(none)
  sortOrder Float @default(65535)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@map("draft_issues")
}

model FileAsset {
  id String @id @default(uuid()) @db.Uuid
  asset String // path
  attributes Json @default("{}")
  size Float @default(0)
  entityType String?
  entityIdentifier String?
  isUploaded Boolean @default(false)
  isDeleted Boolean @default(false)
  userId String? @db.Uuid
  workspaceId String? @db.Uuid
  projectId String? @db.Uuid
  issueId String? @db.Uuid
  pageId String? @db.Uuid
  createdAt DateTime @default(now())
  @@index([entityType, entityIdentifier])
  @@map("file_assets")
}

model Webhook {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  url String
  secretKey String // plane_wh_* generated
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  deletedAt DateTime?
  @@unique([workspaceId, url])
  @@map("webhooks")
}

model WebhookLog {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  webhookId String @db.Uuid
  eventType String?
  requestBody String?
  responseCode Int?
  retryCount Int @default(0)
  createdAt DateTime @default(now())
  @@map("webhook_logs") // retention purge
}

model APIToken {
  id String @id @default(uuid()) @db.Uuid
  userId String @db.Uuid
  workspaceId String? @db.Uuid
  label String @default("")
  token String @unique // plane_api_*
  isActive Boolean @default(true)
  expiredAt DateTime?
  lastUsed DateTime?
  createdAt DateTime @default(now())
  @@map("api_tokens")
}

model ExporterHistory {
  id String @id @default(uuid()) @db.Uuid
  workspaceId String @db.Uuid
  projectIds String[] // uuid array
  initiatedById String @db.Uuid
  provider String // csv|xlsx|json
  token String @unique
  createdAt DateTime @default(now())
  @@map("exporter_history")
}
```

Migrations must add partial uniques (`WHERE deletedAt IS NULL`) for: project identifier/name, state name, estimate name, intake name, module name, cycle/module-issue pairs, reactions, subscribers, webhook url, label splits.
