-- CreateTable
CREATE TABLE "file_assets" (
    "id" UUID NOT NULL,
    "asset" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "size" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entityType" TEXT,
    "entityIdentifier" TEXT,
    "isUploaded" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "userId" UUID,
    "workspaceId" UUID,
    "projectId" UUID,
    "issueId" UUID,
    "pageId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_assets_entityType_entityIdentifier_idx" ON "file_assets"("entityType", "entityIdentifier");
