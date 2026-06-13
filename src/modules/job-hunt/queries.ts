// src/modules/job-hunt/queries.ts
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'

export async function getWatchlist() {
  const { profile } = await requireProfile()
  return prisma.companyWatch.findMany({
    where: { profileId: profile.id, status: { not: 'paused' } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getDiscoveredJobs(filters?: {
  watchIds?: string[]
  boardSourceIds?: string[]
  statuses?: string[]
  sourceType?: 'company' | 'board'
}) {
  const { profile } = await requireProfile()

  return prisma.discoveredJob.findMany({
    where: {
      profileId: profile.id,
      status: filters?.statuses ? { in: filters.statuses } : { notIn: ['ignored'] },
      ...(filters?.sourceType === 'company'
        ? { watchId: { not: null }, boardSourceId: null }
        : filters?.sourceType === 'board'
          ? { boardSourceId: { not: null }, watchId: null }
          : {}),
      ...(filters?.watchIds?.length ? { watchId: { in: filters.watchIds } } : {}),
      ...(filters?.boardSourceIds?.length
        ? { boardSourceId: { in: filters.boardSourceIds } }
        : {}),
    },
    include: {
      watch: { select: { name: true, atsProvider: true, status: true } },
      boardSource: { select: { provider: true } },
    },
    orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getDiscoveredJob(id: string) {
  const { profile } = await requireProfile()
  return prisma.discoveredJob.findFirst({
    where: { id, profileId: profile.id },
  })
}
