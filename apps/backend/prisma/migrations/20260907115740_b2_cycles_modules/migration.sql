-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('backlog', 'planned', 'in_progress', 'paused', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "cycles" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "ownedById" UUID NOT NULL,
    "progressSnapshot" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,
    "archivedAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_issues" (
    "cycleId" UUID NOT NULL,
    "issueId" UUID NOT NULL,

    CONSTRAINT "cycle_issues_pkey" PRIMARY KEY ("cycleId","issueId")
);

-- CreateTable
CREATE TABLE "cycle_user_properties" (
    "id" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "displayFilters" JSONB NOT NULL DEFAULT '{}',
    "displayProperties" JSONB NOT NULL DEFAULT '{}',
    "richFilters" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "cycle_user_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startDate" DATE,
    "targetDate" DATE,
    "status" "ModuleStatus" NOT NULL DEFAULT 'planned',
    "leadId" UUID,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,
    "archivedAt" TIMESTAMP(3),
    "createdBy" UUID,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_members" (
    "moduleId" UUID NOT NULL,
    "memberId" UUID NOT NULL,

    CONSTRAINT "module_members_pkey" PRIMARY KEY ("moduleId","memberId")
);

-- CreateTable
CREATE TABLE "module_issues" (
    "moduleId" UUID NOT NULL,
    "issueId" UUID NOT NULL,

    CONSTRAINT "module_issues_pkey" PRIMARY KEY ("moduleId","issueId")
);

-- CreateTable
CREATE TABLE "module_links" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "module_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_user_properties" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "displayFilters" JSONB NOT NULL DEFAULT '{}',
    "displayProperties" JSONB NOT NULL DEFAULT '{}',
    "richFilters" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "module_user_properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cycle_user_properties_cycleId_userId_key" ON "cycle_user_properties"("cycleId", "userId");

-- CreateIndex
CREATE INDEX "module_links_moduleId_idx" ON "module_links"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "module_user_properties_moduleId_userId_key" ON "module_user_properties"("moduleId", "userId");

-- AddForeignKey
ALTER TABLE "cycle_issues" ADD CONSTRAINT "cycle_issues_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_members" ADD CONSTRAINT "module_members_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_issues" ADD CONSTRAINT "module_issues_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique: module name per project (soft-delete aware).
CREATE UNIQUE INDEX "modules_name_project_unique" ON "modules"("projectId", "name") WHERE "deletedAt" IS NULL;
