import * as z from 'zod'

export const createJobSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  company: z.string().min(1, 'Company is required'),
  url: z.string().url('Must be a valid URL').optional(),
  jobDescription: z.string().optional(),
  jobNumber: z.string().optional(),
  jobPublished: z.date()
})
