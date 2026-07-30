-- AlterTable
ALTER TABLE "Project" ADD COLUMN "exam" BOOLEAN;

-- Clear the per-cursus project checkpoints so the next sync re-fetches every cursus
-- project from epoch and populates the new column. Without this, syncCursusProjects only
-- requests projects whose updated_at moved since the last pull, so existing rows would
-- keep exam = NULL indefinitely. Project inserts are upserts, so replaying is idempotent.
UPDATE "Sync" SET "last_pull" = NULL WHERE "type" = 'cursus_projects';
