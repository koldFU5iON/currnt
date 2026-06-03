'use server'

import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { parseCVContent, type CVSection } from './schema'
import { generateCVContent } from './generate'

export async function createAndGenerateCV({
  jobApplicationId,
}: {
  jobApplicationId?: string
}): Promise<{ id: string }> {
  const { profile } = await requireProfile()

  // If a CV already exists for this job, return it without regenerating
  if (jobApplicationId) {
    const existing = await prisma.cVDocument.findFirst({
      where: { profileId: profile.id, jobApplicationId },
      select: { id: true },
    })
    if (existing) return { id: existing.id }
  }

  const template = await prisma.cVTemplate.findFirst({
    where: { isDefault: true },
    select: { id: true },
  })
  if (!template) throw new Error('No default CV template found. Run npm run db:seed.')

  const doc = await prisma.cVDocument.create({
    data: {
      profileId: profile.id,
      jobApplicationId: jobApplicationId ?? null,
      templateId: template.id,
      generatedContent: '{}',
      status: 'generating',
    },
  })

  const content = await generateCVContent(profile.id, jobApplicationId)

  await prisma.cVDocument.update({
    where: { id: doc.id },
    data: { generatedContent: JSON.stringify(content), status: 'draft' },
  })

  return { id: doc.id }
}

export async function updateSection(cvId: string, section: CVSection): Promise<void> {
  const { profile } = await requireProfile()
  const doc = await prisma.cVDocument.findFirst({
    where: { id: cvId, profileId: profile.id },
    select: { id: true, generatedContent: true },
  })
  if (!doc) throw new Error('CV not found')

  const content = parseCVContent(doc.generatedContent)
  const idx = content.sections.findIndex(s => s.id === section.id)
  if (idx === -1) throw new Error('Section not found')
  content.sections[idx] = section

  await prisma.cVDocument.update({
    where: { id: cvId },
    data: { generatedContent: JSON.stringify(content) },
  })
  revalidatePath(`/dashboard/cv-builder/${cvId}`)
}

export async function toggleVisibility(cvId: string, sectionId: string): Promise<void> {
  const { profile } = await requireProfile()
  const doc = await prisma.cVDocument.findFirst({
    where: { id: cvId, profileId: profile.id },
    select: { id: true, generatedContent: true },
  })
  if (!doc) throw new Error('CV not found')

  const content = parseCVContent(doc.generatedContent)
  const section = content.sections.find(s => s.id === sectionId)
  if (!section) throw new Error('Section not found')
  section.visible = !section.visible

  await prisma.cVDocument.update({
    where: { id: cvId },
    data: { generatedContent: JSON.stringify(content) },
  })
  revalidatePath(`/dashboard/cv-builder/${cvId}`)
}

export async function deleteCV(cvId: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.cVDocument.deleteMany({ where: { id: cvId, profileId: profile.id } })
  revalidatePath('/dashboard/cv-builder')
}
