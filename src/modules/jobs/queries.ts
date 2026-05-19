import { prisma } from "@/lib/db";

export async function getActiveJobs() {
  return prisma.jobApplication.findMany({
    orderBy: { dateApplied: 'desc' }
  })
}


export async function getJobApplicationById(id: string) {
  return prisma.jobApplication.findUnique({
    where: { id }
  })
}
