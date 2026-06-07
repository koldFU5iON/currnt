import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchProviderModels } from './models'

beforeEach(() => { vi.clearAllMocks() })

describe('fetchProviderModels — anthropic', () => {
  it('normalises display_name to name', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'claude-opus-4-8', display_name: 'Claude Opus 4' },
          { id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
        ],
      }),
    })
    const result = await fetchProviderModels('anthropic', 'sk-ant-test')
    expect(result).toEqual([
      { id: 'claude-opus-4-8', name: 'Claude Opus 4' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    ])
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-test',
          'anthropic-version': '2023-06-01',
        }),
      }),
    )
  })

  it('throws "Invalid API key" on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(fetchProviderModels('anthropic', 'bad')).rejects.toThrow('Invalid API key')
  })

  it('throws "Couldn\'t reach provider" on 500', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(fetchProviderModels('anthropic', 'sk-ant-test')).rejects.toThrow("Couldn't reach provider")
  })

  it('throws "No models returned" on empty list', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: [] }) })
    await expect(fetchProviderModels('anthropic', 'sk-ant-test')).rejects.toThrow('No models returned')
  })

  it('throws "Couldn\'t reach provider" on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(fetchProviderModels('anthropic', 'sk-ant-test')).rejects.toThrow("Couldn't reach provider")
  })
})

describe('fetchProviderModels — openai', () => {
  it('filters to chat-capable model prefixes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'gpt-4o' },
          { id: 'gpt-3.5-turbo' },
          { id: 'o1-mini' },
          { id: 'o3' },
          { id: 'davinci-002' },      // filtered out
          { id: 'text-embedding-ada-002' }, // filtered out
        ],
      }),
    })
    const result = await fetchProviderModels('openai', 'sk-test')
    expect(result.map(m => m.id)).toEqual(['gpt-4o', 'gpt-3.5-turbo', 'o1-mini', 'o3'])
  })

  it('throws "Invalid API key" on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(fetchProviderModels('openai', 'bad')).rejects.toThrow('Invalid API key')
  })

  it('throws "Couldn\'t reach provider" on 500', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(fetchProviderModels('openai', 'sk-test')).rejects.toThrow("Couldn't reach provider")
  })

  it('throws "Couldn\'t reach provider" on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(fetchProviderModels('openai', 'sk-test')).rejects.toThrow("Couldn't reach provider")
  })
})

describe('fetchProviderModels — google', () => {
  it('filters to generateContent models and strips models/ prefix', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding-001', displayName: 'Embedding 001', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    })
    const result = await fetchProviderModels('google', 'AI-test')
    expect(result).toEqual([{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }])
  })

  it('throws "Invalid API key" on 403', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
    await expect(fetchProviderModels('google', 'bad')).rejects.toThrow('Invalid API key')
  })

  it('throws "Couldn\'t reach provider" on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(fetchProviderModels('google', 'AI-test')).rejects.toThrow("Couldn't reach provider")
  })
})

describe('fetchProviderModels — unknown provider', () => {
  it('throws for unsupported provider', async () => {
    await expect(fetchProviderModels('llama', 'key')).rejects.toThrow('Unsupported provider')
  })
})
