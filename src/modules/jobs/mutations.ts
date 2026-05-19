'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import * as z from 'zod'
import { createJobSchema } from './schema'
import type { ApplicationStatusType } from '@/app/types/job-application'

export async function createJobApplication(data: z.infer<typeof createJobSchema>) {
  const profile = await prisma.profile.findFirst()
  if (!profile) throw new Error('Profile not found')

  return prisma.jobApplication.create({
    data: {
      ...data,
      profileId: profile.id,
    },
  })
}

export async function updateJobStatus(id: string, status: ApplicationStatusType) {
  await prisma.jobApplication.update({
    where: { id },
    data: { status },
  })
  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${id}`)
}
