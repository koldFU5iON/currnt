'use server'

import { requireProfile } from '@/lib/session'
import { buildProfileSnapshot, serializeProfileForLLM } from '@/modules/profile/snapshot'
import { complete } from '@/modules/llm/client'
import { LLMError, type LLMErrorKind } from '@/modules/llm/errors'
import { loadWritingContext, composeSystem } from '@/modules/llm/prompt-context'

type GenerateSummaryResult =
  | { ok: true; summary: string }
  | { ok: false; error: LLMErrorKind; message: string }

export async function generateProfileSummary(): Promise<GenerateSummaryResult> {
  const { profile } = await requireProfile()
  const [snapshot, { rules, brief }] = await Promise.all([
    buildProfileSnapshot(profile.id),
    loadWritingContext(profile.id),
  ])

  const featureInstructions = `You are an experienced CV writer. Write professional summaries that are specific, honest, and compelling. Use first person. Return only the summary paragraph — no heading, no preamble, no extra commentary.`

  const userPrompt = `Write a concise professional summary of 3–4 sentences for this candidate. Ground it in their actual experience and skills — no generic filler.\n\n${serializeProfileForLLM(snapshot)}`

  try {
    const result = await complete(profile.id, userPrompt, {
      system: composeSystem(rules, brief, featureInstructions),
      maxOutputTokens: 300,
      temperature: 0.4,
      feature: 'profile-summary',
    })
    return { ok: true, summary: result.text.trim() }
  } catch (err) {
    if (err instanceof LLMError) {
      return { ok: false, error: err.kind, message: err.message }
    }
    throw err
  }
}
