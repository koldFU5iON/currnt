import * as z from "zod"

// Stored in UserSettings.onboardingContext as JSON. Keep this small and gentle:
// it is user-provided context for future LLM assistance, not a Career Profile/CV source.
export const onboardingContextSchema = z.object({
  preferredName: z.string().trim().max(120).optional().default(""),
  currentRole: z.string().trim().max(200).optional().default(""),
  targetRole: z.string().trim().max(200).optional().default(""),
  industries: z.string().trim().max(500).optional().default(""),
  workPreferences: z.string().trim().max(500).optional().default(""),
  extraContext: z.string().trim().max(1500).optional().default(""),
  // Additional role types for job hunt scanning — managed from the Job Hunt page,
  // not the onboarding form. Preserved when the onboarding form is saved.
  additionalRoles: z.array(z.string().trim().max(100)).default([]),
})

export type OnboardingContext = z.infer<typeof onboardingContextSchema>

export const emptyOnboardingContext: OnboardingContext = {
  preferredName: "",
  currentRole: "",
  targetRole: "",
  industries: "",
  workPreferences: "",
  extraContext: "",
  additionalRoles: [],
}

export function normalizeOnboardingContext(value: unknown): OnboardingContext {
  const parsed = onboardingContextSchema.safeParse(value ?? {})
  if (!parsed.success) return emptyOnboardingContext
  return parsed.data
}

export function onboardingContextHasContent(context: OnboardingContext) {
  return Object.values(context).some((value) =>
    Array.isArray(value) ? value.length > 0 : value.trim().length > 0,
  )
}
