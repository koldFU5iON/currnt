import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// tsx doesn't auto-load .env.local — load it manually for the seed script
try { process.loadEnvFile('.env.local') } catch {}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

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
  console.log('Seeding...')

  const existing = await prisma.cVTemplate.findFirst({ where: { isDefault: true } })
  if (!existing) {
    await prisma.cVTemplate.create({ data: defaultTemplate })
    console.log('Created default CV template')
  }

  const profile = await prisma.profile.findFirst()
  if (!profile) {
    await prisma.profile.create({
      data: {
        name: 'Your Name',
        headline: 'Your professional headline',
      },
    })
    console.log('Created default profile')
  }

  console.log('Done')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
