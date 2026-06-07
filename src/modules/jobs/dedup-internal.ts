// Non-action dedup module — usable from anywhere on the server (API routes,
// service code) since it takes profileId explicitly instead of reading the
// current session. The 'use server' wrapper next door delegates here.

import { prisma } from '@/lib/db'

export type DuplicateMatch = {
  id: string
  title: string
  company: string | null
  jobNumber: string | null
  status: string
  archivedAt: Date | null
}

// Match tiers, strongest first. Returns the first non-empty tier — never
// blends, so the UI/agent can phrase "this looks like the same posting"
// with confidence.
//
//   strong → exact jobNumber (the canonical posting ID when present)
//   weak   → case-insensitive title + company (best we can do without an ID)
//
// Archived rows are intentionally included: the whole reason archive isn't
// a delete is so re-pasting a stale role still trips the warning.
export async function findPotentialDuplicatesForProfile(
  profileId: string,
  input: {
    jobNumber?: string
    title: string
    company?: string | null
  },
): Promise<DuplicateMatch[]> {
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
      where: { profileId, jobNumber },
      select: SELECT,
    })
    if (strong.length > 0) return strong
  }

  const title = input.title.trim()
  const company = input.company?.trim()
  if (!title || !company) return []

  return prisma.jobApplication.findMany({
    where: {
      profileId,
      title: { equals: title, mode: 'insensitive' },
      company: { equals: company, mode: 'insensitive' },
    },
    select: SELECT,
  })
}
