-- AlterTable
ALTER TABLE "estimates" ADD COLUMN     "createdBy" UUID,
ADD COLUMN     "updatedBy" UUID;

-- AlterTable
ALTER TABLE "issue_comments" ADD COLUMN     "createdBy" UUID,
ADD COLUMN     "updatedBy" UUID;

-- AlterTable
ALTER TABLE "issue_views" ADD COLUMN     "createdBy" UUID,
ADD COLUMN     "updatedBy" UUID;

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "createdBy" UUID,
ADD COLUMN     "updatedBy" UUID;

-- AlterTable
ALTER TABLE "labels" ADD COLUMN     "createdBy" UUID,
ADD COLUMN     "updatedBy" UUID;
