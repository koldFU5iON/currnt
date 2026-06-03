import { prisma } from '@/lib/db'
import { complete } from '@/modules/llm/client'
import { loadWritingContext, loadCVPrompt, composeSystem } from '@/modules/llm/prompt-context'
import { buildProfileSnapshot, serializeProfileForLLM } from '@/modules/profile/snapshot'
import { CVDocumentContentSchema, parseCVContent, type CVDocumentContent } from './schema'

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

  const result = await complete(profileId, userMessage, {
    system: composeSystem(rules, brief, cvPrompt),
    feature: 'cv-generate',
    maxOutputTokens: 4000,
    temperature: 0.3,
  })

  // Extract JSON from the response — LLM may wrap it in ```json fences
  const jsonMatch = result.text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = jsonMatch ? jsonMatch[1].trim() : result.text.trim()

  const parsed = CVDocumentContentSchema.safeParse(JSON.parse(raw))
  if (parsed.success) return parsed.data

  console.error('[generateCVContent] schema validation failed', parsed.error.issues)
  return parseCVContent(raw)
}
