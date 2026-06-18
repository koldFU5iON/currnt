import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/session'
import { prisma } from '@/lib/db'
import { getOnboardingStatus } from '@/modules/onboarding/queries'
import { getLLMConfigStatus } from '@/modules/llm/client'
import { WizardShell } from './_components/WizardShell'

export default async function OnboardingPage() {
  const { profile } = await requireProfile()

  // Guard: already onboarded → redirect to dashboard
  const status = await getOnboardingStatus(profile.id)
  if (status.isComplete) redirect('/dashboard')

  // Load initial data in parallel
  const [llmStatus, experiences] = await Promise.all([
    getLLMConfigStatus(profile.id),
    prisma.experience.findMany({
      where: { profileId: profile.id },
      select: { role: true },
      orderBy: { startDate: 'desc' },
      take: 1,
    }),
  ])

  const latestRole = experiences[0]?.role ?? ''
  const profileImported = experiences.length > 0

  return (
    <WizardShell
      initialLlmStatus={{
        configured: llmStatus.configured,
        provider: llmStatus.provider ?? '',
        model: llmStatus.model ?? '',
        availableModels: llmStatus.availableModels,
      }}
      initialProfileImported={profileImported}
      initialCurrentRole={latestRole}
    />
  )
}
