export type ProviderModel = { id: string; name: string }

async function fetchAnthropic(apiKey: string): Promise<ProviderModel[]> {
  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    })
  } catch {
    throw new Error("Couldn't reach provider — try again.")
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error('Invalid API key — check it and try again.')
    throw new Error("Couldn't reach provider — try again.")
  }
  const data = await res.json() as { data: { id: string; display_name: string }[] }
  const models = data.data.map(m => ({ id: m.id, name: m.display_name }))
  if (models.length === 0)
    throw new Error('No models returned — check your key has the right permissions.')
  return models
}

// Prefix list — update when OpenAI releases new model families (e.g. o5-, o6-).
// 'o1'/'o3'/'o4' match both the bare model IDs and variants like 'o1-mini'.
const OPENAI_CHAT_PREFIXES = ['gpt-', 'o1', 'o3', 'o4', 'chatgpt-']

async function fetchOpenAI(apiKey: string): Promise<ProviderModel[]> {
  let res: Response
  try {
    res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  } catch {
    throw new Error("Couldn't reach provider — try again.")
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error('Invalid API key — check it and try again.')
    throw new Error("Couldn't reach provider — try again.")
  }
  const data = await res.json() as { data: { id: string }[] }
  const models = data.data
    .filter(m => OPENAI_CHAT_PREFIXES.some(p => m.id.startsWith(p)))
    .map(m => ({ id: m.id, name: m.id })) // OpenAI /v1/models has no displayName field
  if (models.length === 0)
    throw new Error('No models returned — check your key has the right permissions.')
  return models
}

async function fetchGoogle(apiKey: string): Promise<ProviderModel[]> {
  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    )
  } catch {
    throw new Error("Couldn't reach provider — try again.")
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error('Invalid API key — check it and try again.')
    throw new Error("Couldn't reach provider — try again.")
  }
  const data = await res.json() as {
    models: { name: string; displayName: string; supportedGenerationMethods: string[] }[]
  }
  const models = data.models
    .filter(m => m.supportedGenerationMethods.includes('generateContent'))
    .map(m => ({ id: m.name.replace(/^models\//, ''), name: m.displayName }))
  if (models.length === 0)
    throw new Error('No models returned — check your key has the right permissions.')
  return models
}

const FETCHERS: Record<string, (apiKey: string) => Promise<ProviderModel[]>> = {
  anthropic: fetchAnthropic,
  openai: fetchOpenAI,
  google: fetchGoogle,
}

export async function fetchProviderModels(
  provider: string,
  apiKey: string,
): Promise<ProviderModel[]> {
  const fetcher = FETCHERS[provider]
  if (!fetcher) throw new Error(`Unsupported provider "${provider}"`)
  return fetcher(apiKey)
}
