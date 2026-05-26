import * as z from 'zod'
import { APPLICATION_SOURCES } from '@/app/types/job-application'

export const createJobSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  company: z.string().min(1, 'Company is required'),
  url: z.string().optional().refine(
    val => !val || z.string().url().safeParse(val).success,
    { message: 'Must be a valid URL' },
  ),
  jobDescription: z.string().optional(),
  jobNumber: z.string().optional(),
  datePublished: z.date().optional(),
  location: z.string().optional(),
  applicationSource: z.enum(APPLICATION_SOURCES),
})

// Same fields, all optional — for partial updates from the edit dialog.
// Per-field constraints (e.g. min(1) on title) still apply when a value is sent.
export const updateJobSchema = createJobSchema.partial()

// Lives here (not next to assessJobFit) because action files use 'use server',
// which forbids non-async exports — schemas have to be reachable from a plain module.
// Constraints are intentionally loose: zod min/max bounds reject the whole
// response if the model trims or pads slightly, and the cost of a retry is
// real money. The prompt asks for 2–3 sentences; if the model returns 1 or 4
// it's still useful. Keep enum bounded — that one's load-bearing for the UI.
export const JobFitSchema = z.object({
  rating: z.number().min(0).max(10).describe('Overall fit score, 0 = no match, 10 = perfect match.'),
  label: z.enum(['poor', 'ok', 'stretch', 'good', 'excellent'])
    .describe('Bucketed verdict. "stretch" = could land it with effort; "good" = strong baseline match.'),
  justification: z.string().min(1)
    .describe('Two or three sentences. Concrete reasoning grounded in candidate and role specifics, no fluff.'),
})

export type JobFit = z.infer<typeof JobFitSchema>
