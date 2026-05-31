'use server'

// First product feature on top of the LLM layer. Pattern is intentionally
// boring — every future AI feature (cover letter, CV refinement, interview
// prep) lands as a copy of this shape with a different schema + prompt.
//
// 1. gather inputs   ← prisma + buildProfileSnapshot
// 2. build prompt    ← markdown for the candidate + role
// 3. call LLM        ← completeStructured with a zod schema
// 4. persist         ← write the validated object to the row
// 5. return          ← discriminated union; UI handles ok vs error kinds
//
// Errors are normalized to the LLM layer's kinds. The action never re-throws
// LLMError — it returns a tagged result so the UI doesn't need try/catch.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { completeStructured } from '@/modules/llm/client'
import { LLMError, type LLMErrorKind } from '@/modules/llm/errors'
import { buildProfileSnapshot, serializeProfileForLLM } from '@/modules/profile/snapshot'
import { normalizeOnboardingContext } from '@/modules/onboarding/schema'
import { loadWritingRules, composeSystem, type WritingContext } from '@/modules/llm/prompt-context'
import { JobFitSchema, type JobFit } from './schema'

// Type is consumed internally only. Callers that need it import from
// '@/modules/jobs/schema' — re-exporting here breaks the 'use server'
// runtime even when using `export type`, because the SWC compiler still
// emits a value-level binding for the re-export.

type AssessJobFitResult =
  | { ok: true; fit: JobFit }
  | { ok: false; error: 'no_description'; message: string }
  | { ok: false; error: 'not_found'; message: string }
  | { ok: false; error: LLMErrorKind; message: string }

export async function assessJobFit(jobId: string): Promise<AssessJobFitResult> {
  const { profile } = await requireProfile()

  const job = await prisma.jobApplication.findFirst({
    where: { id: jobId, profileId: profile.id },
    select: { id: true, title: true, company: true, jobDescription: true, notes: true, notesIncludeInFit: true },
  })
  if (!job) {
    return { ok: false, error: 'not_found', message: 'Job not found' }
  }
  if (!job.jobDescription?.trim()) {
    return {
      ok: false,
      error: 'no_description',
      message: 'Add a job description first — assessment needs it to score against.',
    }
  }

  const [snapshot, settings, rules] = await Promise.all([
    buildProfileSnapshot(profile.id),
    prisma.userSettings.findUnique({
      where: { profileId: profile.id },
      select: { onboardingContext: true, writingBrief: true },
    }),
    loadWritingRules(),
  ])

  const writingCtx: WritingContext = { rules, brief: settings?.writingBrief ?? null }
  const context = normalizeOnboardingContext(settings?.onboardingContext)
  const hasGoals =
    !!(context.targetRole || context.industries || context.workPreferences || context.extraContext)
  const hasNotes = job.notesIncludeInFit && !!job.notes?.trim()

  const featureInstructions = `You are an experienced career coach assessing whether a candidate is a strong fit for a role.

Be honest and concrete. Overclaiming the candidate's fit makes them waste an interview slot; understating loses them an opportunity they could land. Calibrate the rating against real-world hiring bars:

- 0–2 (poor): missing core requirements; would be rejected at first screen.
- 3–4 (ok): partial overlap; would need an exceptional cover letter to advance.
- 5–6 (stretch): meets most requirements but has a meaningful gap; viable with strong story.
- 7–8 (good): strong baseline match; can credibly compete in interviews.
- 9–10 (excellent): unusually well-aligned across role, level, and stack.

Ground your justification in specific evidence from both sides — name technologies, scope, level — rather than generic praise.${hasGoals ? '\n\nWhen a # Career Goals section is provided, populate trajectoryNote with one or two sentences on how this role aligns or diverges from the candidate\'s stated direction. Omit the field entirely when no goals are provided.' : ''}`

  const system = composeSystem(writingCtx.rules, writingCtx.brief, featureInstructions)

  let userPrompt = `# Candidate

${serializeProfileForLLM(snapshot)}

# Role

**${job.title}** at ${job.company}

${job.jobDescription}`

  if (hasGoals) {
    userPrompt += '\n\n# Career Goals\n'
    if (context.targetRole)      userPrompt += `\n**Target role:** ${context.targetRole}`
    if (context.industries)      userPrompt += `\n**Industries:** ${context.industries}`
    if (context.workPreferences) userPrompt += `\n**Work preferences:** ${context.workPreferences}`
    if (context.extraContext)    userPrompt += `\n**Additional context:** ${context.extraContext}`
  }

  if (hasNotes) {
    // User-controlled content — unsanitized intentionally. Injection here only affects
    // the user's own assessment on their own API key; there is no cross-user risk.
    userPrompt += `\n\n# Personal Notes\n\n${job.notes}`
  }

  userPrompt += `\n\nReturn a single JSON object matching the schema. Two or three sentences in the justification${hasGoals ? '; one or two sentences in trajectoryNote' : ''}.`

  let fit: JobFit
  try {
    const result = await completeStructured(profile.id, userPrompt, JobFitSchema, {
      system,
      maxOutputTokens: 600,
      temperature: 0.2,
    })
    fit = result.object
    // notesUsed is ground truth, not the model's self-report: the LLM would
    // set it true even when no notes were in the prompt, surfacing the badge
    // on jobs that have none. hasNotes is the per-job source of truth.
    fit.notesUsed = hasNotes
  } catch (err) {
    if (err instanceof LLMError) {
      return { ok: false, error: err.kind, message: err.message }
    }
    throw err
  }

  await prisma.jobApplication.update({
    where: { id: jobId },
    data: { jobFit: fit, jobFitAssessedAt: new Date() },
  })

  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${jobId}`)

  return { ok: true, fit }
}
