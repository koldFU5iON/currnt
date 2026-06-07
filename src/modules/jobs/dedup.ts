'use server'

import { requireProfile } from '@/lib/session'
import { findPotentialDuplicatesForProfile } from './dedup-internal'

// Server-action wrapper around the internal dedup logic. Lives separately so
// client components can `await findPotentialDuplicates(...)` like a normal RPC,
// while server-side callers (API routes) use the profile-id form directly.
export async function findPotentialDuplicates(input: {
  jobNumber?: string
  title: string
  company?: string | null
}) {
  const { profile } = await requireProfile()
  return findPotentialDuplicatesForProfile(profile.id, input)
}
