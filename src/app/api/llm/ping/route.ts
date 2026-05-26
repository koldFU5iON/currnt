// GET /api/llm/ping — session-authed sanity check that the LLM layer is
// configured and the configured model responds. Cheap (max 16 tokens, temp 0),
// returns the model's reply plus latency + usage so misconfigurations show up
// clearly in the response body.
//
// Not a production user surface — this is the equivalent of `curl localhost`
// for the AI layer.

import { NextResponse } from 'next/server'
import { requireProfile } from '@/lib/session'
import { complete } from '@/modules/llm/client'
import { LLMError } from '@/modules/llm/errors'

export async function GET() {
  try {
    await requireProfile()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'unauthorized', message: 'Sign in to ping the LLM' },
      { status: 401 },
    )
  }

  try {
    const result = await complete('Reply with exactly the word: pong', {
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
    const status =
      llmErr?.kind === 'config' || llmErr?.kind === 'auth'
        ? 503  // service unavailable — not the client's fault, but config-side
        : 502  // upstream issue
    return NextResponse.json(
      {
        ok: false,
        error: llmErr?.kind ?? 'unknown',
        message: llmErr?.message ?? 'LLM call failed',
      },
      { status },
    )
  }
}
