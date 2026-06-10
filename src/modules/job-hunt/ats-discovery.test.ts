// src/modules/job-hunt/ats-discovery.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/modules/llm/client', () => ({
  completeStructured: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { discoverAts } from './ats-discovery'
import { completeStructured } from '@/modules/llm/client'

const mockLLM = vi.mocked(completeStructured)

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockReset()
})

describe('discoverAts', () => {
  it('returns unknown with zero confidence when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    const result = await discoverAts('profile-1', 'https://example.com')
    expect(result.provider).toBe('unknown')
    expect(result.confidence).toBe(0)
    expect(mockLLM).not.toHaveBeenCalled()
  })

  it('calls LLM with truncated HTML from careers page', async () => {
    const html = '<html><script src="boards.greenhouse.io/embed/job_board/js?for=acme"></script></html>'
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => html })
    mockLLM.mockResolvedValueOnce({
      object: {
        provider: 'greenhouse',
        boardSlug: 'acme',
        careersUrl: 'https://boards.greenhouse.io/acme',
        confidence: 0.95,
        reasoning: 'Found Greenhouse embed script',
      },
    } as never)

    const result = await discoverAts('profile-1', 'https://acme.com')

    expect(mockLLM).toHaveBeenCalledOnce()
    expect(result.provider).toBe('greenhouse')
    expect(result.boardSlug).toBe('acme')
    expect(result.confidence).toBe(0.95)
  })

  it('returns unknown when LLM returns unknown provider', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '<html>custom jobs page</html>' })
    mockLLM.mockResolvedValueOnce({
      object: { provider: 'unknown', confidence: 0.1, reasoning: 'No ATS detected' },
    } as never)

    const result = await discoverAts('profile-1', 'https://example.com')
    expect(result.provider).toBe('unknown')
  })
})

describe('SSRF protection', () => {
  it('does not fetch internal metadata endpoints', async () => {
    const result = await discoverAts('profile-1', 'http://169.254.169.254')
    expect(result.provider).toBe('unknown')
    expect(result.confidence).toBe(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not fetch localhost URLs', async () => {
    const result = await discoverAts('profile-1', 'http://localhost/admin')
    expect(result.provider).toBe('unknown')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not fetch bare IP addresses', async () => {
    const result = await discoverAts('profile-1', 'http://192.168.1.1')
    expect(result.provider).toBe('unknown')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
