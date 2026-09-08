-- Add onboarding fields to profiles for frontend onboarding flow
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "isTourCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "onboardingStep" JSONB NOT NULL DEFAULT '{"workspace_join": false, "profile_complete": false, "workspace_create": false, "workspace_invite": false}';
