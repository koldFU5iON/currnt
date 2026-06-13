// src/modules/job-hunt/board-sources/schema.ts
import * as z from 'zod'

export const BOARD_PROVIDERS = ['remotive', 'remoteok', 'adzuna', 'jsearch'] as const
export type BoardProvider = typeof BOARD_PROVIDERS[number]

export const DATE_POSTED_OPTIONS = ['last7', 'last30', 'last90', 'any'] as const
export type DatePosted = typeof DATE_POSTED_OPTIONS[number]

export const JobHuntSearchCriteriaSchema = z.object({
  roles: z.array(z.string()),
  locations: z.array(z.string()),
  datePosted: z.enum(DATE_POSTED_OPTIONS),
  minSalary: z.number().nullable(),
})
export type JobHuntSearchCriteria = z.infer<typeof JobHuntSearchCriteriaSchema>

const DEFAULT_CRITERIA: JobHuntSearchCriteria = {
  roles: [],
  locations: [],
  datePosted: 'last30',
  minSalary: null,
}

export function normalizeJobHuntSearch(raw: unknown): JobHuntSearchCriteria {
  const result = JobHuntSearchCriteriaSchema.safeParse(raw)
  return result.success ? result.data : DEFAULT_CRITERIA
}

export const BoardJobListingSchema = z.object({
  externalId: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  url: z.string(),
  postedAt: z.date().nullable(),
  salary: z.string().nullable(),
})
export type BoardJobListing = z.infer<typeof BoardJobListingSchema>

// Shape stored in UserSettings.jobBoardApiKeys (each value AES-GCM encrypted)
export const JobBoardApiKeysSchema = z.object({
  jsearch: z.string().optional(),
})
export type JobBoardApiKeys = z.infer<typeof JobBoardApiKeysSchema>

export function normalizeJobBoardApiKeys(raw: unknown): JobBoardApiKeys {
  const result = JobBoardApiKeysSchema.safeParse(raw)
  return result.success ? result.data : {}
}
