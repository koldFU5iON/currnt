import * as z from 'zod'

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
})
