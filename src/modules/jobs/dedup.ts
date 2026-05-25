'use server'

import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'

export type DuplicateMatch = {
  id: string
  title: string
  company: string
  jobNumber: string | null
  status: string
  archivedAt: Date | null
}

// Match tiers, strongest first. Returns the first non-empty tier — never blends,
// so the UI can phrase "this looks like the same posting" with confidence.
//
//   strong → exact jobNumber (the canonical posting ID when present)
//   weak   → case-insensitive title + company (best we can do without an ID)
//
// Archived rows are intentionally included: the whole reason archive isn't a
// delete is so re-pasting a stale role still trips the warning.
export async function findPotentialDuplicates(input: {
  jobNumber?: string
  title: string
  company: string
}): Promise<DuplicateMatch[]> {
  const { profile } = await requireProfile()

  const SELECT = {
    id: true,
    title: true,
    company: true,
    jobNumber: true,
    status: true,
    archivedAt: true,
  } as const

  const jobNumber = input.jobNumber?.trim()
  if (jobNumber) {
    const strong = await prisma.jobApplication.findMany({
      where: { profileId: profile.id, jobNumber },
      select: SELECT,
    })
    if (strong.length > 0) return strong
  }

  const title = input.title.trim()
  const company = input.company.trim()
  if (!title || !company) return []

  return prisma.jobApplication.findMany({
    where: {
      profileId: profile.id,
      title: { equals: title, mode: 'insensitive' },
      company: { equals: company, mode: 'insensitive' },
    },
    select: SELECT,
  })
}
