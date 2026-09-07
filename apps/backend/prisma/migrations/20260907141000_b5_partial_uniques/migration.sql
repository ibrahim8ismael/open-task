-- B5: partial unique indexes (soft-delete aware) + trigram search index.
-- Idempotent guards so redeploys never fail on existing indexes.

-- projects: identifier + name unique per workspace
CREATE UNIQUE INDEX IF NOT EXISTS "projects_identifier_ws_partial" ON "projects"("identifier", "workspaceId") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "projects_name_ws_partial" ON "projects"("name", "workspaceId") WHERE "deletedAt" IS NULL;

-- states: name unique per project
CREATE UNIQUE INDEX IF NOT EXISTS "states_name_project_partial" ON "states"("name", "projectId") WHERE "deletedAt" IS NULL;

-- intakes: name unique per project
CREATE UNIQUE INDEX IF NOT EXISTS "intakes_name_project_partial" ON "intakes"("name", "projectId") WHERE "deletedAt" IS NULL;

-- issues: (project, sequence) dense lookup + soft-delete aware
CREATE UNIQUE INDEX IF NOT EXISTS "issues_project_sequence_partial" ON "issues"("projectId", "sequenceId") WHERE "deletedAt" IS NULL;

-- webhooks: url unique per workspace
CREATE UNIQUE INDEX IF NOT EXISTS "webhooks_url_ws_partial" ON "webhooks"("workspaceId", "url") WHERE "deletedAt" IS NULL;

-- pg_trgm for ILIKE search acceleration (extension guarded)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "issues_name_trgm_idx" ON "issues" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "projects_name_trgm_idx" ON "projects" USING gin ("name" gin_trgm_ops);
