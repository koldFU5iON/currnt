// src/modules/job-hunt/board-sources/queries.ts
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { decrypt } from '@/lib/encryption'
import { BOARD_PROVIDERS, normalizeJobBoardApiKeys } from './schema'

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

export async function getJobBoardKeyStatus(): Promise<{
  adzunaConfigured: boolean
  jSearchConfigured: boolean
}> {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { jobBoardApiKeys: true },
  })
  const keys = normalizeJobBoardApiKeys(settings?.jobBoardApiKeys)
  let jSearchOk = false
  if (keys.jsearch) {
    try { decrypt(keys.jsearch); jSearchOk = true } catch { /* corrupt key */ }
  }
  return {
    adzunaConfigured: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    jSearchConfigured: jSearchOk,
  }
}
