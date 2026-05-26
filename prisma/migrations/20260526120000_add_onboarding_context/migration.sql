-- Add lightweight onboarding context to user settings.
-- The JSON shape is documented in src/modules/onboarding/schema.ts.
ALTER TABLE "UserSettings"
  ADD COLUMN "onboardingContext" JSONB,
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingSkippedAt" TIMESTAMP(3);
