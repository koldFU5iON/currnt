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
  statuses?: string[]
}) {
  const { profile } = await requireProfile()
  return prisma.discoveredJob.findMany({
    where: {
      profileId: profile.id,
      status: filters?.statuses ? { in: filters.statuses } : { notIn: ['ignored'] },
      watch: { status: { not: 'paused' } },
      ...(filters?.watchIds?.length ? { watchId: { in: filters.watchIds } } : {}),
    },
    include: { watch: { select: { name: true, atsProvider: true } } },
    orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getDiscoveredJob(id: string) {
  const { profile } = await requireProfile()
  return prisma.discoveredJob.findFirst({
    where: { id, profileId: profile.id },
  })
}
