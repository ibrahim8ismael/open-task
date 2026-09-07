-- AlterEnum
BEGIN;
CREATE TYPE "ModuleStatus_new" AS ENUM ('backlog', 'planned', 'in-progress', 'paused', 'completed', 'cancelled');
ALTER TABLE "public"."modules" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "modules" ALTER COLUMN "status" TYPE "ModuleStatus_new" USING ("status"::text::"ModuleStatus_new");
ALTER TYPE "ModuleStatus" RENAME TO "ModuleStatus_old";
ALTER TYPE "ModuleStatus_new" RENAME TO "ModuleStatus";
DROP TYPE "public"."ModuleStatus_old";
ALTER TABLE "modules" ALTER COLUMN "status" SET DEFAULT 'planned';
COMMIT;
