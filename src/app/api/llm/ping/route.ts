// GET /api/llm/ping — session-authed sanity check using the signed-in user's
// own LLM key + provider. Cheap (max 16 tokens, temp 0). Useful for verifying
// a freshly-entered key works before relying on it in product features.

import { NextResponse } from 'next/server'
import { requireProfile } from '@/lib/session'
import { complete } from '@/modules/llm/client'
import { LLMError } from '@/modules/llm/errors'

const STATUS_BY_KIND: Record<string, number> = {
  not_configured: 412, // precondition required — set up your key first
  config: 503,
  auth: 503,
  rate_limit: 429,
  unavailable: 502,
}

export async function GET() {
  let profileId: string
  try {
    const { profile } = await requireProfile()
    profileId = profile.id
  } catch {
    return NextResponse.json(
      { ok: false, error: 'unauthorized', message: 'Sign in to ping the LLM' },
      { status: 401 },
    )
  }

  try {
    const result = await complete(profileId, 'Reply with exactly the word: pong', {
      feature: 'ping',
      maxOutputTokens: 16,
      temperature: 0,
    })
    return NextResponse.json({
      ok: true,
      reply: result.text,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      usage: result.usage,
    })
  } catch (err) {
    const llmErr = err instanceof LLMError ? err : null
    const kind = llmErr?.kind ?? 'unknown'
    return NextResponse.json(
      {
        ok: false,
        error: kind,
        message: llmErr?.message ?? 'LLM call failed',
      },
      { status: STATUS_BY_KIND[kind] ?? 502 },
    )
  }
}
