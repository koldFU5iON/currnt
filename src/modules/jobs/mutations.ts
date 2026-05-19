'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import * as z from 'zod'
import { createJobSchema } from './schema'
import type { ApplicationStatusType } from '@/app/types/job-application'
import { requireProfile } from '@/lib/session'

export async function createJobApplication(data: z.infer<typeof createJobSchema>) {
  const { profile } = await requireProfile()
  return prisma.jobApplication.create({
    data: {
      ...data,
      profileId: profile.id,
    },
  })
}

export async function updateJobStatus(id: string, status: ApplicationStatusType) {
  const { profile } = await requireProfile()
  const result = await prisma.jobApplication.updateMany({
    where: { id, profileId: profile.id },
    data: { status },
  })
  if (result.count === 0) throw new Error('Job not found')
  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${id}`)
}
