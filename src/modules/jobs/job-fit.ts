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
import { JobFitSchema, type JobFit } from './schema'

// Re-export the type for callers — the schema itself stays in schema.ts because
// 'use server' files can only export async functions.
export type { JobFit }

type AssessJobFitResult =
  | { ok: true; fit: JobFit }
  | { ok: false; error: 'no_description'; message: string }
  | { ok: false; error: 'not_found'; message: string }
  | { ok: false; error: LLMErrorKind; message: string }

export async function assessJobFit(jobId: string): Promise<AssessJobFitResult> {
  const { profile } = await requireProfile()

  // 1. Gather — profile-owned to prevent cross-account read
  const job = await prisma.jobApplication.findFirst({
    where: { id: jobId, profileId: profile.id },
    select: { id: true, title: true, company: true, jobDescription: true },
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

  const snapshot = await buildProfileSnapshot(profile.id)

  // 2. Prompt — system message frames the task, user message holds the data.
  const system = `You are an experienced career coach assessing whether a candidate is a strong fit for a role.

Be honest and concrete. Overclaiming the candidate's fit makes them waste an interview slot; understating loses them an opportunity they could land. Calibrate the rating against real-world hiring bars:

- 0–2 (poor): missing core requirements; would be rejected at first screen.
- 3–4 (ok): partial overlap; would need an exceptional cover letter to advance.
- 5–6 (stretch): meets most requirements but has a meaningful gap; viable with strong story.
- 7–8 (good): strong baseline match; can credibly compete in interviews.
- 9–10 (excellent): unusually well-aligned across role, level, and stack.

Ground your justification in specific evidence from both sides — name technologies, scope, level — rather than generic praise.`

  const prompt = `# Candidate

${serializeProfileForLLM(snapshot)}

# Role

**${job.title}** at ${job.company}

${job.jobDescription}

Return a single JSON object matching the schema. Two or three sentences in the justification.`

  // 3. Call LLM — completeStructured validates against the schema before return,
  //    so by the time we get `object` it's already JobFit-typed and parseable.
  let fit: JobFit
  try {
    const result = await completeStructured(profile.id, prompt, JobFitSchema, {
      system,
      maxOutputTokens: 600,
      temperature: 0.2,
    })
    fit = result.object
  } catch (err) {
    if (err instanceof LLMError) {
      return { ok: false, error: err.kind, message: err.message }
    }
    throw err
  }

  // 4. Persist — Prisma's Json column accepts any structurally-valid object.
  await prisma.jobApplication.update({
    where: { id: jobId },
    data: { jobFit: fit, jobFitAssessedAt: new Date() },
  })

  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${jobId}`)

  return { ok: true, fit }
}
