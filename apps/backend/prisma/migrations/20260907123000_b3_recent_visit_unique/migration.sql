-- AlterTable
ALTER TABLE "intake_issues" ADD COLUMN     "duplicateToId" UUID,
DROP COLUMN "status",
ADD COLUMN     "status" INTEGER NOT NULL DEFAULT -2;

-- DropEnum
DROP TYPE "IntakeStatus";

-- CreateIndex
CREATE UNIQUE INDEX "recent_visits_workspaceId_userId_entityType_entityIdentifie_key" ON "recent_visits"("workspaceId", "userId", "entityType", "entityIdentifier");
