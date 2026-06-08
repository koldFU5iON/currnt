'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'

// ─── Session ─────────────────────────────────────────────────

export async function createSession(input: {
  title: string
  company?: string
  jobTitle?: string
  jobApplicationId?: string
}): Promise<{ id: string }> {
  const { profile } = await requireProfile()

  let company = input.company ?? null
  let jobTitle = input.jobTitle ?? null

  if (input.jobApplicationId) {
    const job = await prisma.jobApplication.findFirst({
      where: { id: input.jobApplicationId, profileId: profile.id },
      select: { title: true, company: true },
    })
    if (job) {
      jobTitle = jobTitle ?? job.title
      company = company ?? job.company ?? null
    }
  }

  const session = await prisma.interviewPrepSession.create({
    data: {
      profileId: profile.id,
      title: input.title,
      company,
      jobTitle,
      jobApplicationId: input.jobApplicationId ?? null,
    },
    select: { id: true },
  })

  await prisma.prepNote.create({
    data: {
      sessionId: session.id,
      profileId: profile.id,
      title: 'Prep Notes',
      order: 0,
    },
  })

  revalidatePath('/dashboard/interview-prep')
  return { id: session.id }
}

export async function updateSessionDetails(
  sessionId: string,
  input: { title?: string; company?: string; jobTitle?: string },
): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.interviewPrepSession.updateMany({
    where: { id: sessionId, profileId: profile.id },
    data: input,
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
}

export async function linkSessionToJob(
  sessionId: string,
  jobApplicationId: string | null,
): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.interviewPrepSession.updateMany({
    where: { id: sessionId, profileId: profile.id },
    data: { jobApplicationId },
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.interviewPrepSession.deleteMany({
    where: { id: sessionId, profileId: profile.id },
  })
  revalidatePath('/dashboard/interview-prep')
}

// ─── Notes ───────────────────────────────────────────────────

export async function createNote(sessionId: string, title: string): Promise<{ id: string }> {
  const { profile } = await requireProfile()
  const count = await prisma.prepNote.count({ where: { sessionId, profileId: profile.id } })
  const note = await prisma.prepNote.create({
    data: { sessionId, profileId: profile.id, title, order: count },
    select: { id: true },
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
  return { id: note.id }
}

export async function renameNote(noteId: string, title: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.prepNote.updateMany({
    where: { id: noteId, profileId: profile.id },
    data: { title },
  })
}

export async function deleteNote(noteId: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.prepNote.deleteMany({
    where: { id: noteId, profileId: profile.id },
  })
}
