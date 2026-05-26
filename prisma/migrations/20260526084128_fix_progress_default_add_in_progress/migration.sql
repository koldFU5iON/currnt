-- AlterTable: progress default should match the "not started" lifecycle stage,
-- not "awaiting response" (which implies the application has been submitted).
ALTER TABLE "JobApplication" ALTER COLUMN "progress" SET DEFAULT 'not started';

-- Backfill: any not-started job stuck with the old default should reset to "not started".
-- Jobs further along in the funnel keep their progress untouched.
UPDATE "JobApplication"
SET "progress" = 'not started'
WHERE "status" = 'not started' AND "progress" = 'awaiting response';
