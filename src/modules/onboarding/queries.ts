import { prisma } from "@/lib/db"
import { requireProfile } from "@/lib/session"
import {
  normalizeOnboardingContext,
  onboardingContextHasContent,
} from "@/modules/onboarding/schema"

export async function getOnboardingSettings() {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: {
      onboardingContext: true,
      onboardingCompletedAt: true,
      onboardingSkippedAt: true,
    },
  })

  const context = normalizeOnboardingContext(settings?.onboardingContext)
  const hasSignal = Boolean(
    settings?.onboardingCompletedAt ||
      settings?.onboardingSkippedAt ||
      onboardingContextHasContent(context),
  )

  return {
    profile,
    context,
    completedAt: settings?.onboardingCompletedAt ?? null,
    skippedAt: settings?.onboardingSkippedAt ?? null,
    hasSignal,
  }
}

export async function getOnboardingStatus(profileId: string): Promise<{ isComplete: boolean }> {
  const settings = await prisma.userSettings.findUnique({
    where: { profileId },
    select: { onboardingCompletedAt: true, onboardingSkippedAt: true },
  })
  return {
    isComplete: Boolean(settings?.onboardingCompletedAt || settings?.onboardingSkippedAt),
  }
}
