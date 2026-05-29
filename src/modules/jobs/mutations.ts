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

// Progress stages in funnel order. Used to compute "everything before stage X"
// for the auto-advance logic below.
const PROGRESS_ORDER = Object.values(ApplicationProgress)

// Declarative status → workflow rules. Adding a new status (or changing the
// auto-advance floor) is now a one-line edit instead of another if-arm.
//   minProgress: floor to bump progress to (never rewinds further-along jobs)
//   setDateApplied: backfill dateApplied if it's still null
type StatusTransition = {
  minProgress?: ApplicationProgressType
  setDateApplied?: boolean
}
const STATUS_TRANSITIONS: Record<ApplicationStatusType, StatusTransition> = {
  [ApplicationStatus.NotStarted]: {},
  [ApplicationStatus.InProgress]: { minProgress: ApplicationProgress.Preparing },
  [ApplicationStatus.Applied]: {
    minProgress: ApplicationProgress.Pending,
    setDateApplied: true,
  },
  [ApplicationStatus.Interviewing]: {
    minProgress: ApplicationProgress.Recruiter,
    setDateApplied: true,
  },
  [ApplicationStatus.Accepted]: { minProgress: ApplicationProgress.Offer },
  [ApplicationStatus.Rejected]: {},
}

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
  const transition = STATUS_TRANSITIONS[status]

  const result = await prisma.jobApplication.updateMany({
    where: { id, profileId: profile.id },
    data: { status },
  })
  if (result.count === 0) throw new Error('Job not found')

  // Backfill applied date the first time the job enters the pipeline.
  if (transition.setDateApplied) {
    await prisma.jobApplication.updateMany({
      where: { id, profileId: profile.id, dateApplied: null },
      data: { dateApplied: new Date() },
    })
  }

  // Auto-advance progress to the floor for this status. The `progress in [stages before]`
  // filter is the "never rewind" guarantee — jobs already further along stay put.
  if (transition.minProgress) {
    const stagesBefore = PROGRESS_ORDER.slice(0, PROGRESS_ORDER.indexOf(transition.minProgress))
    if (stagesBefore.length > 0) {
      await prisma.jobApplication.updateMany({
        where: { id, profileId: profile.id, progress: { in: stagesBefore } },
        data: { progress: transition.minProgress },
      })
    }
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

  const { location, url, salaryBand, ...rest } = validated
  const payload: Record<string, unknown> = { ...rest }
  if (url !== undefined) payload.url = url || null
  if (location !== undefined) {
    payload.countries = location
      ? location.split(',').map(s => s.trim()).filter(Boolean)
      : []
  }
  if (salaryBand !== undefined) payload.salaryBand = salaryBand || null

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

export async function updateJobSalaryBand(id: string, salaryBand: string | null) {
  const { profile } = await requireProfile()

  const result = await prisma.jobApplication.updateMany({
    where: { id, profileId: profile.id },
    data: { salaryBand },
  })
  if (result.count === 0) throw new Error('Job not found')

  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${id}`)
}

export async function updateJobNotes(id: string, notes: string, includeInFit: boolean) {
  const { profile } = await requireProfile()
  const trimmed = notes.trim()

  const result = await prisma.jobApplication.updateMany({
    where: { id, profileId: profile.id },
    data: {
      notes: trimmed || null,
      notesIncludeInFit: trimmed ? includeInFit : false,
    },
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
