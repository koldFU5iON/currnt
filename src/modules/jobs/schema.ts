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
