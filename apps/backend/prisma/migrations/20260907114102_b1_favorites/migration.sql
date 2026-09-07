-- CreateTable
CREATE TABLE "user_favorites" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityIdentifier" UUID,
    "name" TEXT,
    "parentId" UUID,
    "sequence" DOUBLE PRECISION NOT NULL DEFAULT 65535,

    CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_favorites_entityType_entityIdentifier_userId_key" ON "user_favorites"("entityType", "entityIdentifier", "userId");
