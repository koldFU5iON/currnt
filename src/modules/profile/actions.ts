'use server'

import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export type ContactField = 'name' | 'email' | 'phone' | 'location' | 'website' | 'linkedIn'

export async function updateContactField(field: ContactField, value: string) {
  const { profile } = await requireProfile()
  await prisma.profile.update({
    where: { id: profile.id },
    data: { [field]: value.trim() || null },
  })
}

// ── Activities ────────────────────────────────────────────────────────────────

type ActivityData = { kind: string; description: string; impact?: string }

export async function createActivity(experienceId: string, data: ActivityData) {
  const { profile } = await requireProfile()
  const experience = await prisma.experience.findFirst({ where: { id: experienceId, profileId: profile.id } })
  if (!experience) throw new Error('Experience not found')
  const activity = await prisma.roleActivity.create({
    data: { ...data, experienceId, tags: '[]', order: 0 },
  })
  revalidatePath('/dashboard/profile')
  return activity
}

export async function updateActivity(id: string, data: ActivityData) {
  const { profile } = await requireProfile()
  const existing = await prisma.roleActivity.findFirst({
    where: { id, experience: { profileId: profile.id } },
  })
  if (!existing) throw new Error('Activity not found')
  const activity = await prisma.roleActivity.update({ where: { id }, data })
  revalidatePath('/dashboard/profile')
  return activity
}

export async function deleteActivity(id: string) {
  const { profile } = await requireProfile()
  await prisma.roleActivity.deleteMany({
    where: { id, experience: { profileId: profile.id } },
  })
  revalidatePath('/dashboard/profile')
}

// ── Experience ────────────────────────────────────────────────────────────────

type ExperienceData = {
  company: string
  role: string
  location?: string
  remote: boolean
  startDate: Date
  endDate?: Date
  summary: string
}

export async function createExperience(data: ExperienceData) {
  const { profile } = await requireProfile()
  const experience = await prisma.experience.create({
    data: { ...data, profileId: profile.id },
  })
  revalidatePath('/dashboard/profile')
  return experience
}

export async function updateExperience(id: string, data: ExperienceData) {
  const { profile } = await requireProfile()
  const existing = await prisma.experience.findFirst({
    where: { id, profileId: profile.id },
    select: { summary: true },
  })
  const notesChanged = existing?.summary !== data.summary
  const experience = await prisma.experience.update({
    where: { id, profileId: profile.id },
    data: {
      ...data,
      ...(notesChanged ? { notesUpdatedAt: new Date() } : {}),
    },
  })
  revalidatePath('/dashboard/profile')
  revalidatePath(`/dashboard/profile/experience/${id}`)
  return experience
}

export async function deleteExperience(id: string) {
  const { profile } = await requireProfile()
  await prisma.experience.deleteMany({ where: { id, profileId: profile.id } })
  revalidatePath('/dashboard/profile')
}

type ExperienceDetailsData = {
  company: string
  role: string
  location?: string
  remote: boolean
  startDate: Date
  endDate?: Date
}

export async function updateExperienceDetails(id: string, data: ExperienceDetailsData) {
  const { profile } = await requireProfile()
  const experience = await prisma.experience.update({
    where: { id, profileId: profile.id },
    data,
  })
  revalidatePath('/dashboard/profile')
  revalidatePath(`/dashboard/profile/experience/${id}`)
  return experience
}

export async function updateExperienceNotes(id: string, summary: string) {
  const { profile } = await requireProfile()
  const experience = await prisma.experience.update({
    where: { id, profileId: profile.id },
    data: { summary, notesUpdatedAt: new Date() },
  })
  revalidatePath(`/dashboard/profile/experience/${id}`)
  return experience
}

// ── Accept suggestions (bulk transactional) ───────────────────────────────────

type AcceptedActivity = {
  kind: string
  description: string
  impact: string | null
  replaceId?: string // if set, update existing row instead of creating
}

type AcceptedSkill = {
  name: string
  category: string | null
  level: string | null
  replaceId?: string // if set, update existing row instead of creating
}

export type AcceptSuggestionsPayload = {
  experienceId: string
  activities: AcceptedActivity[]
  skills: AcceptedSkill[]
}

export async function acceptSuggestions(payload: AcceptSuggestionsPayload) {
  const { profile } = await requireProfile()

  // Verify ownership before writing anything
  const experience = await prisma.experience.findFirst({
    where: { id: payload.experienceId, profileId: profile.id },
    select: { id: true },
  })
  if (!experience) throw new Error('Experience not found')

  await prisma.$transaction([
    ...payload.activities.map((a) =>
      a.replaceId
        ? prisma.roleActivity.update({
            where: { id: a.replaceId },
            data: { description: a.description, impact: a.impact ?? undefined, kind: a.kind },
          })
        : prisma.roleActivity.create({
            data: {
              experienceId: payload.experienceId,
              kind: a.kind,
              description: a.description,
              impact: a.impact ?? undefined,
              tags: '[]',
              order: 0,
            },
          }),
    ),
    ...payload.skills.map((s) =>
      s.replaceId
        ? prisma.skill.update({
            where: { id: s.replaceId },
            data: {
              name: s.name,
              ...(s.category ? { category: s.category } : {}),
              ...(s.level ? { level: s.level } : {}),
            },
          })
        : prisma.skill.create({
            data: {
              profileId: profile.id,
              name: s.name,
              category: s.category ?? 'General',
              level: s.level ?? 'Intermediate',
              tags: '[]',
            },
          }),
    ),
  ])

  revalidatePath('/dashboard/profile')
  revalidatePath(`/dashboard/profile/experience/${payload.experienceId}`)
}

// ── Skills ────────────────────────────────────────────────────────────────────

type SkillData = { name: string; category: string; level: string; yearsOfExperience?: number }

export async function createSkill(data: SkillData) {
  const { profile } = await requireProfile()
  const skill = await prisma.skill.create({
    data: { ...data, profileId: profile.id, tags: '[]' },
  })
  revalidatePath('/dashboard/profile')
  return skill
}

export async function updateSkill(id: string, data: SkillData) {
  const { profile } = await requireProfile()
  const skill = await prisma.skill.update({ where: { id, profileId: profile.id }, data })
  revalidatePath('/dashboard/profile')
  return skill
}

export async function deleteSkill(id: string) {
  const { profile } = await requireProfile()
  await prisma.skill.deleteMany({ where: { id, profileId: profile.id } })
  revalidatePath('/dashboard/profile')
}

// ── Languages ─────────────────────────────────────────────────────────────────

type LanguageData = { name: string; proficiency: string }

export async function createLanguage(data: LanguageData) {
  const { profile } = await requireProfile()
  const language = await prisma.language.create({
    data: { ...data, profileId: profile.id },
  })
  revalidatePath('/dashboard/profile')
  return language
}

export async function updateLanguage(id: string, data: LanguageData) {
  const { profile } = await requireProfile()
  const language = await prisma.language.update({ where: { id, profileId: profile.id }, data })
  revalidatePath('/dashboard/profile')
  return language
}

export async function deleteLanguage(id: string) {
  const { profile } = await requireProfile()
  await prisma.language.deleteMany({ where: { id, profileId: profile.id } })
  revalidatePath('/dashboard/profile')
}

// ── Education ─────────────────────────────────────────────────────────────────

type EducationData = {
  institution: string
  qualification: string
  field?: string
  startDate: Date
  endDate?: Date
  grade?: string
}

export async function createEducation(data: EducationData) {
  const { profile } = await requireProfile()
  const education = await prisma.education.create({
    data: { ...data, profileId: profile.id, tags: '[]' },
  })
  revalidatePath('/dashboard/profile')
  return education
}

export async function updateEducation(id: string, data: EducationData) {
  const { profile } = await requireProfile()
  const education = await prisma.education.update({ where: { id, profileId: profile.id }, data })
  revalidatePath('/dashboard/profile')
  return education
}

export async function deleteEducation(id: string) {
  const { profile } = await requireProfile()
  await prisma.education.deleteMany({ where: { id, profileId: profile.id } })
  revalidatePath('/dashboard/profile')
}

// ── Certifications ────────────────────────────────────────────────────────────

type CertificationData = {
  name: string
  issuer: string
  issueDate: Date
  expiryDate?: Date
  credentialUrl?: string
}

export async function createCertification(data: CertificationData) {
  const { profile } = await requireProfile()
  const cert = await prisma.certification.create({
    data: { ...data, profileId: profile.id, tags: '[]' },
  })
  revalidatePath('/dashboard/profile')
  return cert
}

export async function updateCertification(id: string, data: CertificationData) {
  const { profile } = await requireProfile()
  const cert = await prisma.certification.update({ where: { id, profileId: profile.id }, data })
  revalidatePath('/dashboard/profile')
  return cert
}

export async function deleteCertification(id: string) {
  const { profile } = await requireProfile()
  await prisma.certification.deleteMany({ where: { id, profileId: profile.id } })
  revalidatePath('/dashboard/profile')
}
