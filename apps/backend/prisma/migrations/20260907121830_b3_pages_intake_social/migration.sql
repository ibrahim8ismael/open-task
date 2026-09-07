-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('Pending', 'Rejected', 'Snoozed', 'Accepted', 'Duplicate');

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "ownedById" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL DEFAULT '',
    "descriptionJson" JSONB NOT NULL DEFAULT '{}',
    "descriptionHtml" TEXT NOT NULL DEFAULT '<p></p>',
    "access" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '',
    "archivedAt" DATE,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,
    "createdBy" UUID,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_versions" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "ownedById" UUID NOT NULL,
    "descriptionJson" JSONB NOT NULL DEFAULT '{}',
    "descriptionHtml" TEXT NOT NULL DEFAULT '',
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_pages" (
    "projectId" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "project_pages_pkey" PRIMARY KEY ("projectId","pageId")
);

-- CreateTable
CREATE TABLE "page_labels" (
    "labelId" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "page_labels_pkey" PRIMARY KEY ("labelId","pageId")
);

-- CreateTable
CREATE TABLE "intakes" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "intakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_issues" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "intakeId" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "status" "IntakeStatus" NOT NULL DEFAULT 'Pending',
    "snoozedTill" TIMESTAMP(3),
    "source" TEXT DEFAULT 'IN_APP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID,
    "receiverId" UUID NOT NULL,
    "triggeredById" UUID,
    "entityName" TEXT NOT NULL,
    "entityIdentifier" UUID,
    "title" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stickies" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT,
    "description" JSONB NOT NULL DEFAULT '{}',
    "color" TEXT,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stickies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_issues" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID,
    "parentId" UUID,
    "stateId" UUID,
    "name" TEXT,
    "descriptionJson" JSONB NOT NULL DEFAULT '{}',
    "priority" "Priority" NOT NULL DEFAULT 'none',
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,
    "createdBy" UUID,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "draft_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_issue_assignees" (
    "draftIssueId" UUID NOT NULL,
    "assigneeId" UUID NOT NULL,

    CONSTRAINT "draft_issue_assignees_pkey" PRIMARY KEY ("draftIssueId","assigneeId")
);

-- CreateTable
CREATE TABLE "draft_issue_labels" (
    "draftIssueId" UUID NOT NULL,
    "labelId" UUID NOT NULL,

    CONSTRAINT "draft_issue_labels_pkey" PRIMARY KEY ("draftIssueId","labelId")
);

-- CreateTable
CREATE TABLE "recent_visits" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityIdentifier" UUID,
    "entityName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recent_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_versions_pageId_idx" ON "page_versions"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "intakes_name_projectId_key" ON "intakes"("name", "projectId");

-- CreateIndex
CREATE INDEX "notifications_receiverId_workspaceId_readAt_createdAt_idx" ON "notifications"("receiverId", "workspaceId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "recent_visits_workspaceId_userId_idx" ON "recent_visits"("workspaceId", "userId");

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_issues" ADD CONSTRAINT "intake_issues_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "intakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
