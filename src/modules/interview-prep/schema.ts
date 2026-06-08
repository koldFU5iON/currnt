import * as z from 'zod'

export const TextBlockSchema = z.object({
  id: z.string(),
  type: z.literal('text'),
  title: z.string(),
  content: z.string(),
  order: z.number(),
})

export const AiAnalysisBlockSchema = z.object({
  id: z.string(),
  type: z.literal('ai-analysis'),
  title: z.string(),
  content: z.string(),
  sourceDocIds: z.array(z.string()).default([]),
  sourceInterviewerIds: z.array(z.string()).default([]),
  order: z.number(),
})

export const QaBankBlockSchema = z.object({
  id: z.string(),
  type: z.literal('qa-bank'),
  title: z.string(),
  content: z.string(),
  order: z.number(),
})

export const BlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  AiAnalysisBlockSchema,
  QaBankBlockSchema,
])

export type TextBlock = z.infer<typeof TextBlockSchema>
export type AiAnalysisBlock = z.infer<typeof AiAnalysisBlockSchema>
export type QaBankBlock = z.infer<typeof QaBankBlockSchema>
export type Block = z.infer<typeof BlockSchema>

export const SectionsSchema = z.array(BlockSchema)
export type Sections = z.infer<typeof SectionsSchema>

export function normalizeSections(raw: unknown): Block[] {
  const result = SectionsSchema.safeParse(raw)
  return result.success ? result.data : []
}

export const PrepSessionSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  title: z.string(),
  company: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  jobApplicationId: z.string().nullable().optional(),
  status: z.string().default('draft'),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type PrepSession = z.infer<typeof PrepSessionSchema>

export const PrepNoteSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  profileId: z.string(),
  title: z.string(),
  sections: SectionsSchema,
  order: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type PrepNote = z.infer<typeof PrepNoteSchema>

export const PrepDocumentSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  profileId: z.string(),
  name: z.string(),
  docType: z.string(),
  content: z.string(),
  aiAnalysis: z.unknown().nullable().optional(),
  aiAnalysedAt: z.date().nullable().optional(),
  createdAt: z.date(),
})

export type PrepDocument = z.infer<typeof PrepDocumentSchema>

export const PrepInterviewerSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  profileId: z.string(),
  name: z.string(),
  role: z.string().nullable().optional(),
  linkedInText: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  aiAnalysis: z.unknown().nullable().optional(),
  aiAnalysedAt: z.date().nullable().optional(),
  createdAt: z.date(),
})

export type PrepInterviewer = z.infer<typeof PrepInterviewerSchema>
