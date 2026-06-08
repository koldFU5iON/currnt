'use server'

import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { complete, completeStructured } from '@/modules/llm/client'
import { LLMError, type LLMErrorKind } from '@/modules/llm/errors'
import { buildProfileSnapshot, serializeProfileForLLM } from '@/modules/profile/snapshot'
import { loadWritingContext, composeSystem } from '@/modules/llm/prompt-context'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { CVDocumentContentSchema } from '@/modules/cv/schema'
import { toMarkdown } from '@/modules/cv/export'
import { ReviewOutputSchema } from './schema'
import type { BuildWithMeInputs, ReviewOutput } from './schema'

type GenerateResult =
  | { ok: true; content: string }
  | { ok: false; error: 'not_found'; message: string }
  | { ok: false; error: LLMErrorKind; message: string }

type ReviewResult =
  | { ok: true; review: ReviewOutput }
  | { ok: false; error: 'not_found' | 'no_content'; message: string }
  | { ok: false; error: LLMErrorKind; message: string }

async function loadGeneratePrompt(): Promise<string> {
  return readFile(
    path.join(process.cwd(), 'src/lib/prompts/cover-letter-generate.md'),
    'utf-8',
  )
}

async function loadReviewPrompt(): Promise<string> {
  return readFile(
    path.join(process.cwd(), 'src/lib/prompts/cover-letter-review.md'),
    'utf-8',
  )
}

async function gatherInputs(profileId: string, letterId: string) {
  const letter = await prisma.coverLetterDocument.findFirst({
    where: { id: letterId, profileId },
    select: {
      id: true,
      content: true,
      jobApplicationId: true,
      jobTitle: true,
      company: true,
      jobApplication: {
        select: { title: true, company: true, jobDescription: true, jobAnalysis: true },
      },
    },
  })
  if (!letter) return null

  const [snapshot, writingCtx] = await Promise.all([
    buildProfileSnapshot(profileId),
    loadWritingContext(profileId),
  ])

  let cvMarkdown: string | null = null
  if (letter.jobApplicationId) {
    const cv = await prisma.cVDocument.findFirst({
      where: { jobApplicationId: letter.jobApplicationId, profileId },
      orderBy: { updatedAt: 'desc' },
      select: { generatedContent: true },
    })
    if (cv) {
      try {
        const parsed = CVDocumentContentSchema.safeParse(JSON.parse(cv.generatedContent))
        if (parsed.success) cvMarkdown = toMarkdown(parsed.data)
      } catch {
        // malformed JSON — skip CV content
      }
    }
  }

  return { letter, snapshot, writingCtx, cvMarkdown }
}

type GatherInputsResult = NonNullable<Awaited<ReturnType<typeof gatherInputs>>>

function buildGeneratePrompt(inputs: GatherInputsResult): string {
  const { letter, snapshot, cvMarkdown } = inputs
  const job = letter.jobApplication
  const profileMd = serializeProfileForLLM(snapshot)

  let prompt = `# Candidate Profile\n\n${profileMd}`

  if (cvMarkdown) {
    prompt += `\n\n# Tailored CV\n\n${cvMarkdown}`
  }

  const title = letter.jobTitle ?? job?.title
  const company = letter.company ?? job?.company
  if (title || company) {
    prompt += `\n\n# Role\n\n**${title ?? 'Unknown role'}**${company ? ` at ${company}` : ''}`
  }

  if (job?.jobDescription) {
    prompt += `\n\n## Job Description\n\n${job.jobDescription}`
  }

  return prompt
}

export async function generateDraft(letterId: string): Promise<GenerateResult> {
  const { profile } = await requireProfile()

  const inputs = await gatherInputs(profile.id, letterId)
  if (!inputs) return { ok: false, error: 'not_found', message: 'Cover letter not found' }

  const systemPrompt = await loadGeneratePrompt()
  const userPrompt = buildGeneratePrompt(inputs)
  const system = composeSystem(inputs.writingCtx.rules, inputs.writingCtx.brief ?? '', systemPrompt)

  try {
    const result = await complete(profile.id, userPrompt, {
      system,
      feature: 'cover-letter-generate',
      temperature: 0.7,
      maxOutputTokens: 1200,
    })
    return { ok: true, content: result.text }
  } catch (err) {
    if (err instanceof LLMError) return { ok: false, error: err.kind, message: err.message }
    throw err
  }
}

export async function buildWithMe(
  letterId: string,
  answers: BuildWithMeInputs,
): Promise<GenerateResult> {
  const { profile } = await requireProfile()

  const inputs = await gatherInputs(profile.id, letterId)
  if (!inputs) return { ok: false, error: 'not_found', message: 'Cover letter not found' }

  let userPrompt = buildGeneratePrompt(inputs)

  const answerLines: string[] = []
  if (answers.whyRole)      answerLines.push(`**Why this role:** ${answers.whyRole}`)
  if (answers.whyCompany)   answerLines.push(`**Why this company:** ${answers.whyCompany}`)
  if (answers.bestEvidence) answerLines.push(`**Best evidence of fit:** ${answers.bestEvidence}`)
  if (answers.whyNow)       answerLines.push(`**Why making this move now:** ${answers.whyNow}`)
  if (answers.anythingElse) answerLines.push(`**Additional context:** ${answers.anythingElse}`)

  if (answerLines.length > 0) {
    userPrompt += `\n\n# Your Context\n\n${answerLines.join('\n\n')}`
  }

  const systemPrompt = await loadGeneratePrompt()
  const system = composeSystem(inputs.writingCtx.rules, inputs.writingCtx.brief ?? '', systemPrompt)

  try {
    const result = await complete(profile.id, userPrompt, {
      system,
      feature: 'cover-letter-build',
      temperature: 0.7,
      maxOutputTokens: 1200,
    })
    return { ok: true, content: result.text }
  } catch (err) {
    if (err instanceof LLMError) return { ok: false, error: err.kind, message: err.message }
    throw err
  }
}

export async function reviewLetter(letterId: string): Promise<ReviewResult> {
  return { ok: false, error: 'not_found', message: 'not implemented' }
}
