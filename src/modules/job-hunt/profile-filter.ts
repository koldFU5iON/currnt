export type ProfileFilterData = {
  targetRole: string
  currentRole: string
  headline: string
  experienceRoles: string[]
  skillNames: string[]
  additionalRoles?: string[]
}

// Each entry is a group of equivalent seniority aliases. Index = seniority level.
const SENIORITY_LEVELS: readonly string[][] = [
  ['intern'],
  ['graduate'],
  ['junior', 'jr', 'jr.'],
  ['associate'],
  ['mid'],
  ['senior', 'sr', 'sr.'],
  ['staff'],
  ['lead'],
  ['principal'],
  ['distinguished'],
  ['fellow'],
]

// Map every alias → its level index for O(1) lookup
const SENIORITY_INDEX: Record<string, number> = {}
for (let i = 0; i < SENIORITY_LEVELS.length; i++) {
  for (const alias of SENIORITY_LEVELS[i]) {
    SENIORITY_INDEX[alias] = i
  }
}

const ROLE_SYNONYMS: Record<string, string[]> = {
  engineer:    ['developer', 'swe', 'sde'],
  engineering: ['software', 'development'],
  manager:     ['mgr', 'lead'],
  product:     ['pm'],
  design:      ['ux', 'ui', 'designer'],
}

const STOP_WORDS = new Set(['of', 'and', 'the', 'a', 'an', 'in', 'at', 'for', 'to'])

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9.\s-]/g, ' ').trim().replace(/\s+/g, ' ')
}

function significantTokens(phrase: string): string[] {
  return phrase.split(/\s+/).filter(t => t.length > 1 && !STOP_WORDS.has(t))
}

function expandSeniority(phrase: string): string[] {
  const tokens = phrase.split(/\s+/)
  for (let i = 0; i < tokens.length; i++) {
    const idx = SENIORITY_INDEX[tokens[i]]
    if (idx === undefined) continue
    const base = tokens.filter((_, j) => j !== i).join(' ').trim()
    if (!base) return [phrase]
    const variants: string[] = []
    for (let offset = -2; offset <= 2; offset++) {
      const newIdx = idx + offset
      if (newIdx >= 0 && newIdx < SENIORITY_LEVELS.length) {
        // Use the first alias of the target level as the canonical form
        variants.push(`${SENIORITY_LEVELS[newIdx][0]} ${base}`)
      }
    }
    return variants.length > 0 ? variants : [phrase]
  }
  return [phrase]
}

function expandSynonyms(phrase: string): string[] {
  const results = [phrase]
  const tokens = phrase.split(/\s+/)
  for (const token of tokens) {
    const synonyms = ROLE_SYNONYMS[token]
    if (synonyms) {
      for (const syn of synonyms) {
        results.push(phrase.replace(new RegExp(`\\b${token}\\b`, 'g'), syn))
      }
    }
  }
  return results
}

export function buildKeywords(profile: ProfileFilterData): string[] {
  const raw: string[] = []

  for (const phrase of [
    profile.targetRole,
    profile.currentRole,
    profile.headline,
    ...profile.experienceRoles,
    ...(profile.additionalRoles ?? []),
  ]) {
    if (phrase?.trim()) raw.push(normalize(phrase))
  }

  for (const skill of profile.skillNames) {
    if (skill?.trim()) raw.push(normalize(skill))
  }

  const expanded: string[] = []
  for (const phrase of raw) {
    const seniorityVariants = expandSeniority(phrase)
    for (const variant of seniorityVariants) {
      expanded.push(...expandSynonyms(variant))
    }
  }

  return [...new Set(expanded.map(k => k.trim()).filter(Boolean))]
}

export function matchesProfile(title: string, keywords: string[]): boolean {
  const normalizedTitle = normalize(title)
  for (const keyword of keywords) {
    const tokens = significantTokens(keyword)
    if (tokens.length === 0) continue
    if (tokens.every(t => normalizedTitle.includes(t))) return true
  }
  return false
}

export function matchesLocation(
  location: string | null | undefined,
  searchLocations: string[],
  includeRemote: boolean,
): boolean {
  // Filter inactive — include everything
  if (searchLocations.length === 0) return true

  // Unknown location — include (benefit of doubt)
  if (!location?.trim()) return true

  const normalized = location.toLowerCase()

  // "remote" anywhere in the string — catches "Remote", "US-Remote", "Remote - EMEA"
  if (includeRemote && normalized.includes('remote')) return true

  // Case-insensitive substring match against any configured location
  return searchLocations.some(loc => normalized.includes(loc.toLowerCase()))
}
