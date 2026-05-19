import { prisma } from "@/lib/db";
import type { Job } from "@/app/types/job-application";

export async function getActiveJobs(): Promise<Job[]> {
  const jobs = await prisma.jobApplication.findMany({
    orderBy: { dateApplied: 'desc' },
  })
  return jobs as Job[]
}

export async function getJobApplicationById(id: string): Promise<Job | null> {
  const job = await prisma.jobApplication.findUnique({
    where: { id },
  })
  return job as Job | null
}
