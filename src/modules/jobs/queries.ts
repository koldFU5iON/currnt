import { prisma } from "@/lib/db"
import type { Job } from "@/app/types/job-application"
import { requireProfile } from "@/lib/session"

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
