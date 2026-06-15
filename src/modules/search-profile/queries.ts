import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { normalizeSearchProfile, normalizeSuggestions } from './schema'

export async function getSearchProfile() {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { searchProfile: true, searchSuggestions: true },
  })
  return {
    profile,
    searchProfile: normalizeSearchProfile(settings?.searchProfile),
    suggestions: normalizeSuggestions(settings?.searchSuggestions),
  }
}

export async function getSuggestionCount(profileId: string): Promise<number> {
  const settings = await prisma.userSettings.findUnique({
    where: { profileId },
    select: { searchSuggestions: true },
  })
  return normalizeSuggestions(settings?.searchSuggestions).length
}
