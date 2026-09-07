-- CreateTable
CREATE TABLE "project_user_properties" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "displayFilters" JSONB NOT NULL DEFAULT '{}',
    "displayProperties" JSONB NOT NULL DEFAULT '{}',
    "richFilters" JSONB NOT NULL DEFAULT '{}',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 65535,

    CONSTRAINT "project_user_properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_user_properties_userId_projectId_key" ON "project_user_properties"("userId", "projectId");
