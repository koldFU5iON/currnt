-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "searchProfile" JSONB,
ADD COLUMN     "searchSuggestions" JSONB;

-- Data migration: populate searchProfile from legacy onboardingContext + jobHuntSearch.
-- Runs once at deploy time. Idempotent — only updates rows where searchProfile IS NULL.
DO $$
DECLARE
  r RECORD;
  oc JSONB;
  jhs JSONB;
  target_role TEXT;
  additional_roles JSONB;
  combined_roles JSONB;
  industries TEXT;
  extra_ctx TEXT;
  career_goals TEXT;
  work_prefs TEXT;
  locations JSONB;
  min_salary NUMERIC;
  sp JSONB;
BEGIN
  FOR r IN
    SELECT id, "onboardingContext", "jobHuntSearch"
    FROM "UserSettings"
    WHERE "searchProfile" IS NULL
      AND ("onboardingContext" IS NOT NULL OR "jobHuntSearch" IS NOT NULL)
  LOOP
    oc  := COALESCE(r."onboardingContext"::jsonb, '{}'::jsonb);
    jhs := COALESCE(r."jobHuntSearch"::jsonb,     '{}'::jsonb);

    -- roles: targetRole first, then additionalRoles
    target_role      := COALESCE(NULLIF(TRIM(oc->>'targetRole'), ''), NULL);
    additional_roles := CASE
      WHEN jsonb_typeof(COALESCE(oc->'additionalRoles', '[]'::jsonb)) = 'array'
      THEN COALESCE(oc->'additionalRoles', '[]'::jsonb)
      ELSE '[]'::jsonb
    END;
    IF target_role IS NOT NULL THEN
      combined_roles := jsonb_build_array(target_role) || additional_roles;
    ELSE
      combined_roles := additional_roles;
    END IF;

    -- careerGoals: industries only
    industries   := COALESCE(NULLIF(TRIM(oc->>'industries'), ''), '');
    career_goals := industries;

    -- extraContext: workPreferences + old extraContext concatenated
    work_prefs := COALESCE(NULLIF(TRIM(oc->>'workPreferences'), ''), '');
    extra_ctx  := COALESCE(NULLIF(TRIM(oc->>'extraContext'), ''), '');
    IF work_prefs <> '' AND extra_ctx <> '' THEN
      work_prefs := work_prefs || E'\n' || extra_ctx;
    ELSIF extra_ctx <> '' THEN
      work_prefs := extra_ctx;
    END IF;

    -- countries from jobHuntSearch.locations
    locations := CASE
      WHEN jsonb_typeof(COALESCE(jhs->'locations', '[]'::jsonb)) = 'array'
      THEN COALESCE(jhs->'locations', '[]'::jsonb)
      ELSE '[]'::jsonb
    END;

    -- salaryBand.min from jobHuntSearch.minSalary
    BEGIN
      min_salary := (jhs->>'minSalary')::numeric;
    EXCEPTION WHEN others THEN
      min_salary := NULL;
    END;

    sp := jsonb_build_object(
      'preferredName',    COALESCE(oc->>'preferredName', ''),
      'currentRole',      COALESCE(oc->>'currentRole', ''),
      'roles',            combined_roles,
      'countries',        locations,
      'remotePreference', '',
      'salaryBand',       CASE WHEN min_salary IS NOT NULL
                          THEN jsonb_build_object('min', min_salary, 'max', NULL::numeric, 'currency', 'GBP')
                          ELSE NULL END,
      'careerGoals',      career_goals,
      'pivotContext',     '',
      'extraContext',     work_prefs
    );

    UPDATE "UserSettings" SET "searchProfile" = sp WHERE id = r.id;
  END LOOP;
END;
$$;
