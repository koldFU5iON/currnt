import { prisma } from "@/lib/db";

export async function getActiveJobs() {
  return prisma.jobApplication.findMany({
    orderBy: { applied: 'desc' }
  })
}
