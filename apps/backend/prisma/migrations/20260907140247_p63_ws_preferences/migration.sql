-- DropIndex
DROP INDEX "issues_name_trgm_idx";

-- DropIndex
DROP INDEX "projects_name_trgm_idx";

-- CreateTable
CREATE TABLE "workspace_user_links" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workspace_user_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_home_preferences" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,

    CONSTRAINT "workspace_home_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_user_preferences" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,

    CONSTRAINT "workspace_user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_home_preferences_workspaceId_userId_key_key" ON "workspace_home_preferences"("workspaceId", "userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_user_preferences_workspaceId_userId_key_key" ON "workspace_user_preferences"("workspaceId", "userId", "key");
