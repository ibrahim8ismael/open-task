-- AlterTable
ALTER TABLE "cycle_issues" DROP CONSTRAINT "cycle_issues_pkey",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "cycle_issues_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_issues_cycleId_issueId_key" ON "cycle_issues"("cycleId", "issueId");
