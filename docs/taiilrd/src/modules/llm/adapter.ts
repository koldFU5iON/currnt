// ============================================================
// TAIILRD — LLM Abstraction Layer
// Provider-agnostic. Add a new provider by implementing
// the LLMAdapter interface and registering it in getAdapter().
// ============================================================

import type { LLMConfig, LLMMessage, LLMResponse, LLMProvider } from '@/types'

// ------------------------------------------------------------
// Base adapter interface — every provider implements this
// ------------------------------------------------------------

export interface LLMAdapter {
  complete(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse>
  isConfigured(config: LLMConfig): boolean
}

// ------------------------------------------------------------
// Anthropic adapter
// ------------------------------------------------------------

const anthropicAdapter: LLMAdapter = {
  isConfigured: (config) => Boolean(config.apiKey),

  complete: async (messages, config) => {
    if (!config.apiKey) throw new LLMConfigError('Anthropic API key is required')

    const systemMessage = messages.find((m) => m.role === 'system')
    const conversationMessages = messages.filter((m) => m.role !== 'system')

    const body: Record<string, unknown> = {
      model: config.model || 'claude-sonnet-4-20250514',
      max_tokens: config.maxTokens || 4096,
      messages: conversationMessages,
    }

    if (systemMessage) {
      body.system = systemMessage.content
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new LLMProviderError('anthropic', response.status, error)
    }

    const data = await response.json()
    const content = data.content?.[0]?.text ?? ''

    return {
      content,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
      provider: 'anthropic',
      model: data.model,
    }
  },
}

// ------------------------------------------------------------
// OpenAI adapter
// ------------------------------------------------------------

const openAIAdapter: LLMAdapter = {
  isConfigured: (config) => Boolean(config.apiKey),

  complete: async (messages, config) => {
    if (!config.apiKey) throw new LLMConfigError('OpenAI API key is required')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o',
        max_tokens: config.maxTokens || 4096,
        messages,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new LLMProviderError('openai', response.status, error)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    return {
      content,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      provider: 'openai',
      model: data.model,
    }
  },
}

// ------------------------------------------------------------
// Ollama adapter (local)
// ------------------------------------------------------------

const ollamaAdapter: LLMAdapter = {
  isConfigured: (config) => Boolean(config.baseUrl),

  complete: async (messages, config) => {
    const baseUrl = config.baseUrl || 'http://localhost:11434'

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'llama3.2',
        messages,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new LLMProviderError('ollama', response.status, {})
    }

    const data = await response.json()
    const content = data.message?.content ?? ''

    return {
      content,
      provider: 'ollama',
      model: config.model || 'llama3.2',
    }
  },
}

// ------------------------------------------------------------
// Registry — add new providers here
// ------------------------------------------------------------

const adapters: Record<LLMProvider, LLMAdapter> = {
  anthropic: anthropicAdapter,
  openai: openAIAdapter,
  ollama: ollamaAdapter,
  google: createStubAdapter('google'), // placeholder for future
  custom: createStubAdapter('custom'), // placeholder for future
}

function createStubAdapter(provider: string): LLMAdapter {
  return {
    isConfigured: () => false,
    complete: async () => {
      throw new LLMConfigError(`${provider} adapter not yet implemented`)
    },
  }
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

export function getAdapter(provider: LLMProvider): LLMAdapter {
  const adapter = adapters[provider]
  if (!adapter) throw new LLMConfigError(`Unknown LLM provider: ${provider}`)
  return adapter
}

export async function llmComplete(
  messages: LLMMessage[],
  config: LLMConfig
): Promise<LLMResponse> {
  const adapter = getAdapter(config.provider)

  if (!adapter.isConfigured(config)) {
    throw new LLMConfigError(
      `LLM provider "${config.provider}" is not configured. Check your API key or endpoint settings.`
    )
  }

  return adapter.complete(messages, config)
}

// ------------------------------------------------------------
// Default models per provider
// ------------------------------------------------------------

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  ollama: 'llama3.2',
  google: 'gemini-1.5-pro',
  custom: '',
}

// ------------------------------------------------------------
// Errors
// ------------------------------------------------------------

export class LLMConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LLMConfigError'
  }
}

export class LLMProviderError extends Error {
  constructor(
    public provider: string,
    public statusCode: number,
    public details: unknown
  ) {
    super(`LLM provider error from ${provider}: HTTP ${statusCode}`)
    this.name = 'LLMProviderError'
  }
}
