-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER', 'GUEST');

-- CreateEnum
CREATE TYPE "StateGroup" AS ENUM ('backlog', 'unstarted', 'started', 'completed', 'cancelled', 'triage');

-- CreateEnum
CREATE TYPE "Network" AS ENUM ('Secret', 'Public');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT NOT NULL DEFAULT '',
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperuser" BOOLEAN NOT NULL DEFAULT false,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "userTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "lastActive" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "lastWorkspaceId" UUID,
    "startOfWeek" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "sessionKey" TEXT NOT NULL,
    "sessionData" TEXT NOT NULL,
    "expireAt" TIMESTAMP(3) NOT NULL,
    "deviceInfo" JSONB,
    "userId" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("sessionKey")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "organizationSize" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewProps" JSONB NOT NULL DEFAULT '{}',
    "issueProps" JSONB NOT NULL DEFAULT '{"subscribed":true}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_member_invites" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_member_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_user_properties" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "displayFilters" JSONB NOT NULL DEFAULT '{}',
    "displayProperties" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "workspace_user_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "network" "Network" NOT NULL DEFAULT 'Public',
    "emoji" TEXT,
    "archiveIn" INTEGER NOT NULL DEFAULT 0,
    "closeIn" INTEGER NOT NULL DEFAULT 0,
    "moduleView" BOOLEAN NOT NULL DEFAULT false,
    "cycleView" BOOLEAN NOT NULL DEFAULT false,
    "issueViewsView" BOOLEAN NOT NULL DEFAULT false,
    "pageView" BOOLEAN NOT NULL DEFAULT true,
    "intakeView" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultStateId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "states" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#808080',
    "group" "StateGroup" NOT NULL DEFAULT 'backlog',
    "sequence" DOUBLE PRECISION NOT NULL DEFAULT 65535,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isTriage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_memberId_key" ON "workspace_members"("workspaceId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_member_invites_email_workspaceId_key" ON "workspace_member_invites"("email", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_workspaceId_key" ON "teams"("name", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_user_properties_workspaceId_userId_key" ON "workspace_user_properties"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_identifier_workspaceId_key" ON "projects"("identifier", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_workspaceId_key" ON "projects"("name", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "states_name_projectId_key" ON "states"("name", "projectId");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_defaultStateId_fkey" FOREIGN KEY ("defaultStateId") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "states" ADD CONSTRAINT "states_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
