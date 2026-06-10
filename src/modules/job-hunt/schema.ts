// src/modules/job-hunt/schema.ts
import * as z from 'zod'

export const ATS_PROVIDERS = ['greenhouse', 'lever', 'ashby', 'unknown'] as const
export type AtsProvider = typeof ATS_PROVIDERS[number]

export const COMPANY_WATCH_STATUSES = ['active', 'paused', 'discovery_failed'] as const
export type CompanyWatchStatus = typeof COMPANY_WATCH_STATUSES[number]

export const DISCOVERED_JOB_STATUSES = ['new', 'scored', 'imported', 'ignored'] as const
export type DiscoveredJobStatus = typeof DISCOVERED_JOB_STATUSES[number]

export const JobListingSchema = z.object({
  externalId: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  url: z.string().url(),
  postedAt: z.date().nullable(),
})
export type JobListing = z.infer<typeof JobListingSchema>

export const AtsDiscoveryResultSchema = z.object({
  provider: z.enum(ATS_PROVIDERS),
  boardSlug: z.string().optional(),
  careersUrl: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})
export type AtsDiscoveryResult = z.infer<typeof AtsDiscoveryResultSchema>

export const AddCompanyInputSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: z.string().url('Must be a valid URL'),
})
export type AddCompanyInput = z.infer<typeof AddCompanyInputSchema>

export const ScanResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    found: z.number(),
    matched: z.number(),
    newJobs: z.number(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.enum(['not_found', 'no_ats_detected', 'fetch_failed']),
  }),
])
export type ScanResult = z.infer<typeof ScanResultSchema>

export const AtsHintSchema = z.object({
  provider: z.enum(['greenhouse', 'lever', 'ashby']),
  boardSlug: z.string(),
  name: z.string(),
})
export type AtsHint = z.infer<typeof AtsHintSchema>
