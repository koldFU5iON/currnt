import * as z from 'zod'

export const SalaryBandSchema = z.object({
  min: z.number().nullable().default(null),
  max: z.number().nullable().default(null),
  currency: z.string().default('GBP'),
})

export type SalaryBand = z.infer<typeof SalaryBandSchema>

export const SEARCH_PROFILE_FIELDS = [
  'preferredName', 'currentRole', 'roles', 'countries',
  'remotePreference', 'salaryBand', 'careerGoals', 'pivotContext', 'extraContext',
] as const

export type SearchProfileField = typeof SEARCH_PROFILE_FIELDS[number]

export const SearchProfileSchema = z.object({
  preferredName:    z.string().trim().max(120).default(''),
  currentRole:      z.string().trim().max(200).default(''),
  roles:            z.array(z.string().trim().max(100)).default([]),
  countries:        z.array(z.string().trim().max(100)).default([]),
  remotePreference: z.enum(['remote', 'hybrid', 'onsite', 'flexible', '']).default(''),
  salaryBand:       SalaryBandSchema.nullable().default(null),
  careerGoals:      z.string().trim().max(3000).default(''),
  pivotContext:     z.string().trim().max(3000).default(''),
  extraContext:     z.string().trim().max(3000).default(''),
})

export type SearchProfile = z.infer<typeof SearchProfileSchema>

export const SearchSuggestionSchema = z.object({
  id:             z.string(),
  field:          z.enum(SEARCH_PROFILE_FIELDS),
  suggestedValue: z.unknown(),
  reason:         z.string(),
  source:         z.enum(['job-fit', 'chat', 'cover-letter', 'interview-prep']),
  createdAt:      z.string(),
})

export type SearchSuggestion = z.infer<typeof SearchSuggestionSchema>

export const emptySearchProfile: SearchProfile = {
  preferredName: '', currentRole: '', roles: [], countries: [],
  remotePreference: '', salaryBand: null,
  careerGoals: '', pivotContext: '', extraContext: '',
}

export function normalizeSearchProfile(value: unknown): SearchProfile {
  const result = SearchProfileSchema.safeParse(value ?? {})
  return result.success ? result.data : { ...emptySearchProfile }
}

export function searchProfileHasContent(profile: SearchProfile): boolean {
  return (
    profile.preferredName.length > 0 ||
    profile.currentRole.length > 0 ||
    profile.roles.length > 0 ||
    profile.countries.length > 0 ||
    profile.remotePreference !== '' ||
    profile.salaryBand !== null ||
    profile.careerGoals.length > 0 ||
    profile.pivotContext.length > 0 ||
    profile.extraContext.length > 0
  )
}

export function normalizeSuggestions(value: unknown): SearchSuggestion[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => SearchSuggestionSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: SearchSuggestion }).data)
}

export function formatSalaryBand(band: SalaryBand): string {
  const symbol = band.currency === 'GBP' ? '£' : band.currency === 'EUR' ? '€' : '$'
  const min = band.min != null ? `${symbol}${band.min.toLocaleString()}` : null
  const max = band.max != null ? `${symbol}${band.max.toLocaleString()}` : null
  if (min && max) return `${min}–${max} ${band.currency}`
  if (min) return `${min}+ ${band.currency}`
  if (max) return `up to ${max} ${band.currency}`
  return band.currency
}
