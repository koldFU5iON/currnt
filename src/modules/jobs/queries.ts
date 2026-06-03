import { prisma } from "@/lib/db"
import type { ApplicationStatusType, Job } from "@/app/types/job-application"
import { requireProfile } from "@/lib/session"

export type DashboardJobSlim = {
  id: string
  title: string
  company: string
  status: ApplicationStatusType
  lastUpdated: Date
}

export type DashboardStats = {
  totalActive: number
  byStatus: Partial<Record<ApplicationStatusType, number>>
  lastActivity: Date | null
  recentJobs: DashboardJobSlim[]
  staleJobs: DashboardJobSlim[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { profile } = await requireProfile()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [statusRows, recentRows, staleRows] = await Promise.all([
    prisma.jobApplication.findMany({
      where: { profileId: profile.id, archivedAt: null },
      select: { status: true, lastUpdated: true },
    }),
    prisma.jobApplication.findMany({
      where: { profileId: profile.id, archivedAt: null },
      orderBy: { lastUpdated: 'desc' },
      take: 4,
      select: { id: true, title: true, company: true, status: true, lastUpdated: true },
    }),
    prisma.jobApplication.findMany({
      where: {
        profileId: profile.id,
        archivedAt: null,
        OR: [
          { status: 'not started', lastUpdated: { lt: sevenDaysAgo } },
          { status: { in: ['in-progress', 'applied'] }, lastUpdated: { lt: fourteenDaysAgo } },
        ],
      },
      orderBy: { lastUpdated: 'asc' },
      take: 5,
      select: { id: true, title: true, company: true, status: true, lastUpdated: true },
    }),
  ])

  const byStatus = statusRows.reduce<Partial<Record<ApplicationStatusType, number>>>((acc, row) => {
    const s = row.status as ApplicationStatusType
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  const lastActivity = statusRows.length > 0
    ? statusRows.reduce<Date>((latest, row) =>
        row.lastUpdated > latest ? row.lastUpdated : latest,
        statusRows[0].lastUpdated
      )
    : null

  return {
    totalActive: statusRows.length,
    byStatus,
    lastActivity,
    recentJobs: recentRows as DashboardJobSlim[],
    staleJobs: staleRows as DashboardJobSlim[],
  }
}

export async function getActiveJobs(): Promise<Job[]> {
  const { profile } = await requireProfile()
  const jobs = await prisma.jobApplication.findMany({
    where: { profileId: profile.id, archivedAt: null },
    orderBy: [{ dateApplied: { sort: 'desc', nulls: 'last' } }, { lastUpdated: 'desc' }],
  })
  return jobs as Job[]
}

export async function getJobApplicationById(id: string): Promise<Job | null> {
  const { profile } = await requireProfile()
  const job = await prisma.jobApplication.findFirst({
    where: { id, profileId: profile.id },
  })
  return job as Job | null
}

export async function getArchivedJobs(): Promise<Job[]> {
  const { profile } = await requireProfile()
  const jobs = await prisma.jobApplication.findMany({
    where: { profileId: profile.id, archivedAt: { not: null } },
    orderBy: [{ archivedAt: 'desc' }],
  })
  return jobs as Job[]
}
