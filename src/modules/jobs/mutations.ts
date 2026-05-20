'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import * as z from 'zod'
import { createJobSchema } from './schema'
import {
  ApplicationProgress,
  ApplicationStatus,
  type ApplicationProgressType,
  type ApplicationStatusType,
} from '@/app/types/job-application'
import { requireProfile } from '@/lib/session'

// Progress stages that precede "recruiter screening", in funnel order.
const PROGRESS_ORDER = Object.values(ApplicationProgress)
const PRE_INTERVIEW_PROGRESS = PROGRESS_ORDER.slice(
  0,
  PROGRESS_ORDER.indexOf(ApplicationProgress.Recruiter),
)

export async function createJobApplication(data: z.infer<typeof createJobSchema>) {
  const { profile } = await requireProfile()
  return prisma.jobApplication.create({
    data: {
      ...data,
      profileId: profile.id,
    },
  })
}

export async function updateJobDate(id: string, date: Date) {
  const { profile } = await requireProfile()

  const result = await prisma.jobApplication.updateMany({
    where: { id, profileId: profile.id },
    data: { dateApplied: date },
  })
  if (result.count === 0) throw new Error('Job not found')

  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${id}`)
}

export async function updateJobStatus(id: string, status: ApplicationStatusType) {
  const { profile } = await requireProfile()

  const result = await prisma.jobApplication.updateMany({
    where: { id, profileId: profile.id },
    data: { status },
  })
  if (result.count === 0) throw new Error('Job not found')

  // Backfill the applied date the first time the job enters the pipeline —
  // never overwrite an existing value, so manual edits stay intact.
  if (
    status === ApplicationStatus.Applied ||
    status === ApplicationStatus.Interviewing
  ) {
    await prisma.jobApplication.updateMany({
      where: { id, profileId: profile.id, dateApplied: null },
      data: { dateApplied: new Date() },
    })
  }

  // Kick off the funnel when interviews start, without rewinding real progress.
  if (status === ApplicationStatus.Interviewing) {
    await prisma.jobApplication.updateMany({
      where: { id, profileId: profile.id, progress: { in: PRE_INTERVIEW_PROGRESS } },
      data: { progress: ApplicationProgress.Recruiter },
    })
  }

  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${id}`)
}

export async function updateJobProgress(id: string, progress: ApplicationProgressType) {
  const { profile } = await requireProfile()

  const result = await prisma.jobApplication.updateMany({
    where: { id, profileId: profile.id },
    data: { progress },
  })
  if (result.count === 0) throw new Error('Job not found')

  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${id}`)
}
