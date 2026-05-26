// Server-only LLM façade — bring-your-own-key. Each user supplies their own
// provider API key via /dashboard/settings/llm; this module fetches their
// settings, decrypts the key, and runs the call against the provider they
// chose. Token costs land on the user's account, not the app owner's.
//
// Product features call complete()/completeStructured() with a profileId and
// never import from 'ai' or any provider SDK directly — adding a new provider
// is a single addition to PROVIDERS below, with no ripple beyond this file.

import { generateText, Output, type LanguageModel, type LanguageModelUsage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { z } from 'zod'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { LLMError, normalizeLLMError } from './errors'

// Supported providers. Adding a new one is a single entry here — the factory
// receives the user's decrypted API key and the model id and returns a
// LanguageModel suitable for generateText.
type ProviderFactory = (apiKey: string, modelId: string) => LanguageModel

const PROVIDERS: Record<string, ProviderFactory> = {
  anthropic: (apiKey, modelId) => createAnthropic({ apiKey })(modelId),
  openai: (apiKey, modelId) => createOpenAI({ apiKey })(modelId),
  google: (apiKey, modelId) => createGoogleGenerativeAI({ apiKey })(modelId),
}

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDERS) as ReadonlyArray<keyof typeof PROVIDERS>

type ResolvedConfig = {
  provider: string
  model: string
  apiKey: string
}

async function resolveConfig(profileId: string): Promise<ResolvedConfig> {
  const settings = await prisma.userSettings.findUnique({
    where: { profileId },
    select: { llmProvider: true, llmModel: true, llmApiKey: true },
  })

  if (!settings?.llmApiKey) {
    throw new LLMError(
      'No LLM API key configured. Add one at /dashboard/settings/llm.',
      'not_configured',
    )
  }

  const provider = settings.llmProvider
  if (!PROVIDERS[provider]) {
    throw new LLMError(
      `Unsupported LLM provider "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}.`,
      'config',
    )
  }

  const apiKey = decrypt(settings.llmApiKey)
  if (!apiKey) {
    // Decryption failure usually means ENCRYPTION_KEY rotated without backfill.
    // Either way, the stored ciphertext is unusable; tell the user to re-enter.
    throw new LLMError(
      'Stored API key could not be decrypted. Re-enter your key in settings.',
      'config',
    )
  }

  return { provider, model: settings.llmModel, apiKey }
}

export type CompleteOptions = {
  /** Override the user's default model for this call (e.g. switch to a stronger model). */
  model?: string
  /** System prompt — sets persona / constraints separately from the user prompt. */
  system?: string
  /** Cap on generated tokens. Useful for keeping costs bounded. */
  maxOutputTokens?: number
  /** 0–1; lower = more deterministic. */
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

export async function complete(
  profileId: string,
  prompt: string,
  opts: CompleteOptions = {},
): Promise<CompleteResult> {
  const cfg = await resolveConfig(profileId)
  const modelId = opts.model ?? cfg.model
  const model = PROVIDERS[cfg.provider](cfg.apiKey, modelId)

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
      provider: cfg.provider,
      model: modelId,
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

export async function completeStructured<T>(
  profileId: string,
  prompt: string,
  schema: z.ZodType<T>,
  opts: CompleteOptions = {},
): Promise<CompleteStructuredResult<T>> {
  const cfg = await resolveConfig(profileId)
  const modelId = opts.model ?? cfg.model
  const model = PROVIDERS[cfg.provider](cfg.apiKey, modelId)

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
      provider: cfg.provider,
      model: modelId,
      usage: result.usage,
      latencyMs: Date.now() - startedAt,
    }
  } catch (err) {
    throw normalizeLLMError(err)
  }
}

// Lightweight read-only check for UIs that want to render "key configured"
// state without paying for a full ping. Returns the provider/model the user
// has saved (no key material).
export async function getLLMConfigStatus(profileId: string): Promise<{
  configured: boolean
  provider: string | null
  model: string | null
}> {
  const settings = await prisma.userSettings.findUnique({
    where: { profileId },
    select: { llmProvider: true, llmModel: true, llmApiKey: true },
  })
  return {
    configured: !!settings?.llmApiKey,
    provider: settings?.llmProvider ?? null,
    model: settings?.llmModel ?? null,
  }
}
