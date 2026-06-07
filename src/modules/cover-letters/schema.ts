import * as z from 'zod'

export const coverLetterSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  jobApplicationId: z.string().nullable(),
  content: z.string().default(''),
  status: z.string().default('draft'),
  jobTitle: z.string().nullable(),
  company: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type CoverLetter = z.infer<typeof coverLetterSchema>

export const coverLetterListItemSchema = coverLetterSchema.omit({ profileId: true })

export type CoverLetterListItem = z.infer<typeof coverLetterListItemSchema>
