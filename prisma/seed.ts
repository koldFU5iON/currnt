// tsx doesn't auto-load .env.local — load it manually for the seed script
// This must happen BEFORE importing modules that read process.env at module init time
try { process.loadEnvFile('.env.local') } catch {}

import { jobApplications } from './seeds/job.seed'
import { experiences, skills, educations, languages, competencies } from './seeds/profile.seed'

const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'password'
const TEST_NAME = 'Test User'

const defaultTemplate = {
  name: 'Standard CV',
  region: 'global',
  description: 'A clean, general-purpose CV template suitable for most roles.',
  sections: JSON.stringify([
    { id: 'summary',        label: 'Professional Summary', included: true,  order: 1 },
    { id: 'experience',     label: 'Experience',           included: true,  order: 2 },
    { id: 'education',      label: 'Education',            included: true,  order: 3 },
    { id: 'skills',         label: 'Skills',               included: true,  order: 4 },
    { id: 'projects',       label: 'Projects',             included: false, order: 5 },
    { id: 'certifications', label: 'Certifications',       included: false, order: 6 },
  ]),
  isDefault: true,
  isBuiltIn: true,
}

async function main() {
  // Dynamic imports so .env.local is loaded before these modules initialize
  const { prisma } = await import('../src/lib/db')
  const { auth } = await import('../src/lib/auth')

  console.log('Seeding...')

  const existingTemplate = await prisma.cVTemplate.findFirst({ where: { isDefault: true } })
  if (!existingTemplate) {
    await prisma.cVTemplate.create({ data: defaultTemplate })
    console.log('Created default CV template')
  }

  const existingUser = await prisma.user.findUnique({ where: { email: TEST_EMAIL } })
  if (!existingUser) {
    await auth.api.signUpEmail({
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
    })
    console.log(`Created test user: ${TEST_EMAIL} / ${TEST_PASSWORD}`)
  }

  const profile = await prisma.profile.findFirst({ where: { user: { email: TEST_EMAIL } } })
  if (!profile) throw new Error(`Profile not auto-created for ${TEST_EMAIL}`)

  const existingJobs = await prisma.jobApplication.count({ where: { profileId: profile.id } })
  if (existingJobs === 0) {
    await prisma.jobApplication.createMany({
      data: jobApplications.map((job) => ({ ...job, profileId: profile.id })),
    })
    console.log(`Created ${jobApplications.length} dummy job applications for test user`)
  }

  const existingExperiences = await prisma.experience.count({ where: { profileId: profile.id } })
  if (existingExperiences === 0) {
    for (const { activities, ...experience } of experiences) {
      await prisma.experience.create({
        data: { ...experience, profileId: profile.id, activities: { create: activities } },
      })
    }
    await prisma.skill.createMany({ data: skills.map((s) => ({ ...s, profileId: profile.id })) })
    await prisma.education.createMany({ data: educations.map((e) => ({ ...e, profileId: profile.id })) })
    await prisma.language.createMany({ data: languages.map((l) => ({ ...l, profileId: profile.id })) })
    await prisma.competency.createMany({ data: competencies.map((c) => ({ ...c, profileId: profile.id })) })
    console.log(
      `Created profile content for test user (${experiences.length} experiences, ${skills.length} skills)`,
    )
  }

  console.log('Done')
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
