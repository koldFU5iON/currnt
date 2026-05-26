// Server-only LLM façade. Product features call `complete()` /
// `completeStructured()` and never import from `ai` directly — that way the
// SDK or provider can be swapped without rippling through the app.
//
// Defaults route through the Vercel AI Gateway (`AI_GATEWAY_API_KEY`), so a
// model is just a `provider/name` string. Switching to OpenAI is a one-line
// env change once you've got an OpenAI provider enabled on the Gateway.

import { generateText, Output, type LanguageModelUsage } from 'ai'
import type { z } from 'zod'
import { normalizeLLMError } from './errors'

// Latest stable Claude Sonnet at time of writing. Override per-call via the
// `model` option or globally via the LLM_MODEL env var.
const DEFAULT_MODEL = process.env.LLM_MODEL || 'anthropic/claude-sonnet-4.6'

function providerOf(modelId: string): string {
  const slash = modelId.indexOf('/')
  return slash > 0 ? modelId.slice(0, slash) : 'unknown'
}

export type CompleteOptions = {
  /** Override the default model for this call, e.g. 'openai/gpt-5'. */
  model?: string
  /** System prompt — sets persona / constraints separately from the user prompt. */
  system?: string
  /** Cap on generated tokens. Useful for keeping costs bounded. */
  maxOutputTokens?: number
  /** 0–1; lower = more deterministic. Default leaves the provider's default in place. */
  temperature?: number
}

type ResponseMeta = {
  provider: string
  model: string
  usage: LanguageModelUsage
  latencyMs: number
}

export type CompleteResult = ResponseMeta & {
  text: string
  finishReason: string
}

export async function complete(prompt: string, opts: CompleteOptions = {}): Promise<CompleteResult> {
  const model = opts.model ?? DEFAULT_MODEL
  const startedAt = Date.now()
  try {
    const result = await generateText({
      model,
      prompt,
      system: opts.system,
      maxOutputTokens: opts.maxOutputTokens,
      temperature: opts.temperature,
    })
    return {
      text: result.text,
      finishReason: result.finishReason,
      provider: providerOf(model),
      model,
      usage: result.usage,
      latencyMs: Date.now() - startedAt,
    }
  } catch (err) {
    throw normalizeLLMError(err)
  }
}

export type CompleteStructuredResult<T> = ResponseMeta & {
  object: T
}

// Structured output — the model is steered to produce JSON matching `schema`,
// and the result is validated/parsed before return. Throws LLMError with
// kind='invalid_output' if the model can't produce conforming output.
export async function completeStructured<T>(
  prompt: string,
  schema: z.ZodType<T>,
  opts: CompleteOptions = {},
): Promise<CompleteStructuredResult<T>> {
  const model = opts.model ?? DEFAULT_MODEL
  const startedAt = Date.now()
  try {
    const result = await generateText({
      model,
      prompt,
      system: opts.system,
      maxOutputTokens: opts.maxOutputTokens,
      temperature: opts.temperature,
      output: Output.object({ schema }),
    })
    return {
      object: result.output as T,
      provider: providerOf(model),
      model,
      usage: result.usage,
      latencyMs: Date.now() - startedAt,
    }
  } catch (err) {
    throw normalizeLLMError(err)
  }
}
