-- Data migration: rename job-fit label values from the old scale to the new one.
-- 'poor' (0-2) becomes 'unlikely'; 'ok' (3-4) becomes 'weak'.
-- jobFit is a jsonb column so we use jsonb_set to update in place.

UPDATE "JobApplication"
SET "jobFit" = jsonb_set("jobFit"::jsonb, '{label}', '"unlikely"')
WHERE "jobFit" IS NOT NULL AND "jobFit"->>'label' = 'poor';

UPDATE "JobApplication"
SET "jobFit" = jsonb_set("jobFit"::jsonb, '{label}', '"weak"')
WHERE "jobFit" IS NOT NULL AND "jobFit"->>'label' = 'ok';
