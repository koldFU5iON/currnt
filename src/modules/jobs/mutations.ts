'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import * as z from 'zod'
import { createJobSchema, updateJobSchema } from './schema'
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
  const { location, url, ...rest } = data
  const countries = location
    ? location.split(',').map(s => s.trim()).filter(Boolean)
    : []
  return prisma.jobApplication.create({
    data: {
      ...rest,
      url: url || undefined,
      countries,
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

  // Advance progress from "not started" to "awaiting response" when submitting —
  // only nudge from the default; never overwrite real progress.
  if (status === ApplicationStatus.Applied) {
    await prisma.jobApplication.updateMany({
      where: { id, profileId: profile.id, progress: ApplicationProgress.NotStarted },
      data: { progress: ApplicationProgress.Pending },
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

export async function updateJobApplication(
  id: string,
  data: z.infer<typeof updateJobSchema>,
) {
  const { profile } = await requireProfile()
  const validated = updateJobSchema.parse(data)

  const { location, url, ...rest } = validated
  const payload: Record<string, unknown> = { ...rest }
  if (url !== undefined) payload.url = url || null
  if (location !== undefined) {
    payload.countries = location
      ? location.split(',').map(s => s.trim()).filter(Boolean)
      : []
  }

  const result = await prisma.jobApplication.updateMany({
    where: { id, profileId: profile.id },
    data: payload,
  })
  if (result.count === 0) throw new Error('Job not found')

  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${id}`)
}

export async function archiveJobApplication(id: string) {
  const { profile } = await requireProfile()

  const result = await prisma.jobApplication.updateMany({
    where: { id, profileId: profile.id },
    data: { archivedAt: new Date() },
  })
  if (result.count === 0) throw new Error('Job not found')

  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${id}`)
}

export async function bulkArchiveJobApplications(ids: string[]) {
  if (ids.length === 0) return { archived: 0 }
  const { profile } = await requireProfile()

  const result = await prisma.jobApplication.updateMany({
    where: { id: { in: ids }, profileId: profile.id },
    data: { archivedAt: new Date() },
  })

  revalidatePath('/dashboard/job-applications')
  return { archived: result.count }
}
