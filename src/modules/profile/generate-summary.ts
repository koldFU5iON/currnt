'use server'

import { requireProfile } from '@/lib/session'
import { buildProfileSnapshot, serializeProfileForLLM } from '@/modules/profile/snapshot'
import { complete } from '@/modules/llm/client'
import { LLMError, type LLMErrorKind } from '@/modules/llm/errors'

type GenerateSummaryResult =
  | { ok: true; summary: string }
  | { ok: false; error: LLMErrorKind; message: string }

export async function generateProfileSummary(): Promise<GenerateSummaryResult> {
  const { profile } = await requireProfile()
  const snapshot = await buildProfileSnapshot(profile.id)

  const system = `You are an experienced CV writer. Write professional summaries that are specific, honest, and compelling. Use first person. Return only the summary paragraph — no heading, no preamble, no extra commentary.`

  const userPrompt = `Write a concise professional summary of 3–4 sentences for this candidate. Ground it in their actual experience and skills — no generic filler.\n\n${serializeProfileForLLM(snapshot)}`

  try {
    const result = await complete(profile.id, userPrompt, {
      system,
      maxOutputTokens: 200,
      temperature: 0.4,
    })
    return { ok: true, summary: result.text.trim() }
  } catch (err) {
    if (err instanceof LLMError) {
      return { ok: false, error: err.kind, message: err.message }
    }
    throw err
  }
}
