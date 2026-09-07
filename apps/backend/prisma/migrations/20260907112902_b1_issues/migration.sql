-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('urgent', 'high', 'medium', 'low', 'none');

-- CreateEnum
CREATE TYPE "EstimateType" AS ENUM ('categories', 'points');

-- CreateEnum
CREATE TYPE "IssueRelationType" AS ENUM ('duplicate', 'relates_to', 'blocked_by', 'start_before', 'finish_before', 'implemented_by');

-- CreateTable
CREATE TABLE "labels" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EstimateType" NOT NULL DEFAULT 'categories',
    "lastUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_points" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "estimateId" UUID NOT NULL,
    "key" INTEGER NOT NULL DEFAULT 0,
    "value" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "estimate_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_types" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isEpic" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "level" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "issue_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_issue_types" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "issueTypeId" UUID NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "project_issue_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "parentId" UUID,
    "stateId" UUID,
    "typeId" UUID,
    "estimatePointId" UUID,
    "name" TEXT NOT NULL DEFAULT '',
    "descriptionJson" JSONB NOT NULL DEFAULT '{}',
    "descriptionHtml" TEXT NOT NULL DEFAULT '<p></p>',
    "descriptionStripped" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'none',
    "startDate" DATE,
    "targetDate" DATE,
    "sequenceId" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,
    "completedAt" TIMESTAMP(3),
    "archivedAt" DATE,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "point" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_sequences" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "issueId" UUID,
    "sequence" BIGINT NOT NULL DEFAULT 1,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "issue_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_assignees" (
    "issueId" UUID NOT NULL,
    "assigneeId" UUID NOT NULL,

    CONSTRAINT "issue_assignees_pkey" PRIMARY KEY ("issueId","assigneeId")
);

-- CreateTable
CREATE TABLE "issue_labels" (
    "issueId" UUID NOT NULL,
    "labelId" UUID NOT NULL,

    CONSTRAINT "issue_labels_pkey" PRIMARY KEY ("issueId","labelId")
);

-- CreateTable
CREATE TABLE "issue_relations" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "relatedIssueId" UUID NOT NULL,
    "relationType" "IssueRelationType" NOT NULL DEFAULT 'blocked_by',

    CONSTRAINT "issue_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_blockers" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "blockId" UUID NOT NULL,
    "blockedById" UUID NOT NULL,

    CONSTRAINT "issue_blockers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_comments" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "parentId" UUID,
    "actorId" UUID,
    "commentJson" JSONB NOT NULL DEFAULT '{}',
    "commentHtml" TEXT NOT NULL DEFAULT '<p></p>',
    "commentStripped" TEXT NOT NULL DEFAULT '',
    "access" TEXT NOT NULL DEFAULT 'INTERNAL',
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "issue_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_attachments" (
    "id" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "asset" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_links" (
    "id" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "issue_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_activities" (
    "id" UUID NOT NULL,
    "issueId" UUID,
    "actorId" UUID,
    "verb" TEXT NOT NULL DEFAULT 'created',
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_subscribers" (
    "issueId" UUID NOT NULL,
    "subscriberId" UUID NOT NULL,

    CONSTRAINT "issue_subscribers_pkey" PRIMARY KEY ("issueId","subscriberId")
);

-- CreateTable
CREATE TABLE "issue_reactions" (
    "issueId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "reaction" TEXT NOT NULL,

    CONSTRAINT "issue_reactions_pkey" PRIMARY KEY ("issueId","actorId","reaction")
);

-- CreateTable
CREATE TABLE "comment_reactions" (
    "commentId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "reaction" TEXT NOT NULL,

    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("commentId","actorId","reaction")
);

-- CreateTable
CREATE TABLE "issue_votes" (
    "issueId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "vote" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "issue_votes_pkey" PRIMARY KEY ("issueId","actorId")
);

-- CreateTable
CREATE TABLE "issue_versions" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "priority" "Priority" NOT NULL DEFAULT 'none',
    "sequenceId" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,
    "completedAt" TIMESTAMP(3),
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_views" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID,
    "ownedById" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "query" JSONB NOT NULL DEFAULT '{}',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "displayFilters" JSONB NOT NULL DEFAULT '{}',
    "displayProperties" JSONB NOT NULL DEFAULT '{}',
    "access" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "issue_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_issue_types_projectId_issueTypeId_key" ON "project_issue_types"("projectId", "issueTypeId");

-- CreateIndex
CREATE INDEX "issues_projectId_sequenceId_idx" ON "issues"("projectId", "sequenceId");

-- CreateIndex
CREATE INDEX "issues_projectId_stateId_idx" ON "issues"("projectId", "stateId");

-- CreateIndex
CREATE UNIQUE INDEX "issue_sequences_issueId_key" ON "issue_sequences"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "issue_relations_issueId_relatedIssueId_key" ON "issue_relations"("issueId", "relatedIssueId");

-- CreateIndex
CREATE INDEX "issue_comments_issueId_idx" ON "issue_comments"("issueId");

-- CreateIndex
CREATE INDEX "issue_attachments_issueId_idx" ON "issue_attachments"("issueId");

-- CreateIndex
CREATE INDEX "issue_links_issueId_idx" ON "issue_links"("issueId");

-- CreateIndex
CREATE INDEX "issue_activities_issueId_idx" ON "issue_activities"("issueId");

-- CreateIndex
CREATE INDEX "issue_versions_issueId_idx" ON "issue_versions"("issueId");

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_points" ADD CONSTRAINT "estimate_points_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_estimatePointId_fkey" FOREIGN KEY ("estimatePointId") REFERENCES "estimate_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique indexes (soft-delete aware, docs/02): labels + estimates.
-- Project/state/identifier uniques from earlier migrations stay non-partial until B5.
CREATE UNIQUE INDEX "labels_name_global_unique" ON "labels"("name") WHERE "projectId" IS NULL AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX "labels_name_project_unique" ON "labels"("projectId", "name") WHERE "projectId" IS NOT NULL AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX "estimates_name_project_unique" ON "estimates"("projectId", "name") WHERE "deletedAt" IS NULL;
