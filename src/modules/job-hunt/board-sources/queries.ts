// src/modules/job-hunt/board-sources/queries.ts
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { BOARD_PROVIDERS } from './schema'

export async function ensureBoardSources(profileId: string): Promise<void> {
  await Promise.all(
    BOARD_PROVIDERS.map((provider) =>
      prisma.jobBoardSource.upsert({
        where: { profileId_provider: { profileId, provider } },
        create: { profileId, provider, enabled: true },
        update: {},
      }),
    ),
  )
}

export async function getBoardSources() {
  const { profile } = await requireProfile()
  await ensureBoardSources(profile.id)
  return prisma.jobBoardSource.findMany({
    where: { profileId: profile.id },
    orderBy: { provider: 'asc' },
  })
}

export async function getJobHuntSearch() {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { jobHuntSearch: true, onboardingContext: true },
  })
  return {
    jobHuntSearch: settings?.jobHuntSearch ?? null,
    onboardingContext: settings?.onboardingContext ?? null,
  }
}
