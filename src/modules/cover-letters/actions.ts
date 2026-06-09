'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { buildCoverLetterTemplate } from './template'

export async function createCoverLetter(jobApplicationId?: string): Promise<{ id: string }> {
  const { profile } = await requireProfile()

  let jobTitle: string | null = null
  let company: string | null = null

  if (jobApplicationId) {
    const job = await prisma.jobApplication.findFirst({
      where: { id: jobApplicationId, profileId: profile.id },
      select: { title: true, company: true },
    })
    if (job) {
      jobTitle = job.title
      company = job.company ?? null
    }
  }

  const letter = await prisma.coverLetterDocument.create({
    data: {
      profileId: profile.id,
      jobApplicationId: jobApplicationId ?? null,
      jobTitle,
      company,
      mode: 'markdown',
      status: 'draft',
      content: buildCoverLetterTemplate(profile),
    },
    select: { id: true },
  })

  return { id: letter.id }
}

export async function linkJobToCoverLetter(
  id: string,
  jobApplicationId: string,
): Promise<{ jobTitle: string | null; company: string | null }> {
  const { profile } = await requireProfile()

  const job = await prisma.jobApplication.findFirst({
    where: { id: jobApplicationId, profileId: profile.id },
    select: { title: true, company: true },
  })
  if (!job) throw new Error('Job not found')

  const jobTitle = job.title
  const company = job.company ?? null

  const updated = await prisma.coverLetterDocument.updateMany({
    where: { id, profileId: profile.id },
    data: { jobApplicationId, jobTitle, company },
  })
  if (updated.count === 0) throw new Error('Cover letter not found')

  revalidatePath(`/dashboard/cover-letters/${id}`)
  return { jobTitle, company }
}

export async function updateCoverLetterContent(id: string, content: string): Promise<void> {
  const { profile } = await requireProfile()

  const updated = await prisma.coverLetterDocument.updateMany({
    where: { id, profileId: profile.id },
    data: { content },
  })

  if (updated.count === 0) throw new Error('Cover letter not found')
}

export async function deleteCoverLetter(id: string): Promise<void> {
  const { profile } = await requireProfile()

  const deleted = await prisma.coverLetterDocument.deleteMany({
    where: { id, profileId: profile.id },
  })

  if (deleted.count === 0) throw new Error('Cover letter not found')

  revalidatePath('/dashboard/cover-letters')
}
