-- CreateTable
CREATE TABLE "exporter_history" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectIds" TEXT[],
    "initiatedById" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "filePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exporter_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "events" JSONB NOT NULL DEFAULT '["*"]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "webhookId" UUID NOT NULL,
    "eventType" TEXT,
    "requestBody" TEXT,
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "workspaceId" UUID,
    "label" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiredAt" TIMESTAMP(3),
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_activity_logs" (
    "id" UUID NOT NULL,
    "tokenIdentifier" TEXT,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "queryParams" TEXT,
    "responseCode" INTEGER,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exporter_history_token_key" ON "exporter_history"("token");

-- CreateIndex
CREATE UNIQUE INDEX "webhooks_workspaceId_url_key" ON "webhooks"("workspaceId", "url");

-- CreateIndex
CREATE INDEX "webhook_logs_webhookId_idx" ON "webhook_logs"("webhookId");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_key" ON "api_tokens"("token");

-- CreateIndex
CREATE INDEX "api_activity_logs_tokenIdentifier_idx" ON "api_activity_logs"("tokenIdentifier");
