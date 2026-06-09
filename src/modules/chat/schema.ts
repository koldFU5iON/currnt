import { z } from 'zod'

export const PageContextSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('cv'),
    cvId: z.string(),
    title: z.string(),
    company: z.string().optional(),
  }),
  z.object({
    type: z.literal('job_fit'),
    jobId: z.string(),
    company: z.string(),
    fitScore: z.number(),
    jdSnippet: z.string(),
  }),
  z.object({
    type: z.literal('cover_letter'),
    letterId: z.string(),
    company: z.string().optional(),
  }),
  z.object({
    type: z.literal('interview_prep'),
    sessionId: z.string(),
    company: z.string().optional(),
    role: z.string().optional(),
  }),
])

export type PageContext = z.infer<typeof PageContextSchema>

export const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({ role: z.enum(['user', 'assistant']), content: z.string() }),
  ),
  pageContext: PageContextSchema.nullable().optional(),
})

export const SummarizeRequestSchema = z.object({
  messages: z.array(
    z.object({ role: z.enum(['user', 'assistant']), content: z.string() }),
  ),
})
