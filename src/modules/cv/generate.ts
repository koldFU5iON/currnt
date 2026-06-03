import { z } from 'zod'
import { prisma } from '@/lib/db'
import { completeStructured } from '@/modules/llm/client'
import { loadWritingContext, loadCVPrompt, composeSystem } from '@/modules/llm/prompt-context'
import { buildProfileSnapshot, serializeProfileForLLM } from '@/modules/profile/snapshot'
import { CVDocumentContentSchema, parseCVContent, type CVDocumentContent } from './schema'

// Flat schema used for the LLM call — avoids grammar-too-large errors from
// discriminated unions. Full validation happens after via CVDocumentContentSchema.
const LooseCVDocumentSchema = z.object({
  version: z.literal(1),
  sections: z.array(z.object({
    id: z.string(),
    type: z.string(),
    visible: z.boolean(),
    data: z.record(z.string(), z.unknown()),
  })),
})

const SCHEMA_HINT = `
Section types and their data shapes:
- header:        { name, headline, subHeadline?, contact: { email?, phone?, linkedin?, website? } }
- profile:       { content }  -- prose, Markdown allowed
- competencies:  { items: string[] }
- capabilities:  { items: string[] }
- experience:    { company, titles: string[], location, duration, description, outcomes: string[] }
- education:     { institution, qualification, field?, duration, grade? }
- certification: { name, issuer?, date?, url? }
- skills:        { items: string[] }
- tools:         { items: string[] }
- languages:     { items: [{ name, proficiency }] }
`

export async function generateCVContent(
  profileId: string,
  jobApplicationId?: string,
): Promise<CVDocumentContent> {
  const [snapshot, { rules, brief }, cvPrompt, jobApp] = await Promise.all([
    buildProfileSnapshot(profileId),
    loadWritingContext(profileId),
    loadCVPrompt(),
    jobApplicationId
      ? prisma.jobApplication.findFirst({
          where: { id: jobApplicationId, profileId },
          select: { jobDescription: true, title: true, company: true },
        })
      : Promise.resolve(null),
  ])

  const jobContext = jobApp?.jobDescription
    ? `== JOB TARGET ==\nRole: ${jobApp.title} at ${jobApp.company}\n\n${jobApp.jobDescription}`
    : `== MODE: GENERIC CV ==\nNo specific job target. Include all significant experience.`

  const userMessage = [
    jobContext,
    '',
    '== CANDIDATE PROFILE ==',
    serializeProfileForLLM(snapshot),
    '',
    '== OUTPUT SCHEMA ==',
    SCHEMA_HINT,
  ].join('\n')

  const result = await completeStructured(
    profileId,
    userMessage,
    LooseCVDocumentSchema,
    {
      system: composeSystem(rules, brief, cvPrompt),
      feature: 'cv-generate',
      maxOutputTokens: 4000,
      temperature: 0.3,
    },
  )

  // Validate through the strict schema now that we have the response
  const parsed = CVDocumentContentSchema.safeParse(result.object)
  if (parsed.success) return parsed.data

  // Log validation issues and fall back to parseCVContent which handles partial data
  console.error('[generateCVContent] strict schema validation failed', parsed.error.issues)
  return parseCVContent(JSON.stringify(result.object))
}
