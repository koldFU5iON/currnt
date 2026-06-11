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
  it('returns unknown with zero confidence when all fetches fail', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    const result = await discoverAts('profile-1', 'https://example.com')
    expect(result.provider).toBe('unknown')
    expect(result.confidence).toBe(0)
    expect(mockLLM).not.toHaveBeenCalled()
  })

  it('detects Greenhouse from embed URL in page source without LLM', async () => {
    const html = '<html><script src="boards.greenhouse.io/embed/job_board/js?for=acme"></script></html>'
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => html })

    const result = await discoverAts('profile-1', 'https://acme.com')

    expect(mockLLM).not.toHaveBeenCalled()
    expect(result.provider).toBe('greenhouse')
    expect(result.boardSlug).toBe('acme')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('detects Lever from board URL in page source without LLM', async () => {
    const html = '<html><a href="https://jobs.lever.co/stripe/abc123">Apply</a></html>'
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => html })

    const result = await discoverAts('profile-1', 'https://stripe.com')

    expect(mockLLM).not.toHaveBeenCalled()
    expect(result.provider).toBe('lever')
    expect(result.boardSlug).toBe('stripe')
  })

  it('detects Ashby from board URL in page source without LLM', async () => {
    const html = '<html><a href="https://jobs.ashbyhq.com/vercel">Open roles</a></html>'
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => html })

    const result = await discoverAts('profile-1', 'https://vercel.com')

    expect(mockLLM).not.toHaveBeenCalled()
    expect(result.provider).toBe('ashby')
    expect(result.boardSlug).toBe('vercel')
  })

  it('falls back to LLM when HTML has no recognizable ATS patterns', async () => {
    const html = '<html><head><title>Careers at Acme</title></head><body><h1>Join us</h1></body></html>'
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => html })
    mockLLM.mockResolvedValueOnce({
      object: {
        provider: 'greenhouse',
        boardSlug: 'acme',
        careersUrl: 'https://boards.greenhouse.io/acme',
        confidence: 0.8,
        reasoning: 'Inferred from context',
      },
    } as never)

    const result = await discoverAts('profile-1', 'https://acme.com')

    expect(mockLLM).toHaveBeenCalledOnce()
    expect(result.provider).toBe('greenhouse')
    expect(result.boardSlug).toBe('acme')
  })

  it('returns unknown when LLM returns unknown provider', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '<html>custom jobs page</html>' })
    mockLLM.mockResolvedValueOnce({
      object: { provider: 'unknown', confidence: 0.1, reasoning: 'No ATS detected' },
    } as never)

    const result = await discoverAts('profile-1', 'https://example.com')
    expect(result.provider).toBe('unknown')
  })

  it('tries the specific job URL itself before falling back to origin paths', async () => {
    const jobUrl = 'https://careers.playstation.com/optimisation-manager/job/6005905004'
    const html = '<html><script src="boards.greenhouse.io/embed/job_board/js?for=sonyinteractiveentertainmentglobal"></script></html>'

    // Only first fetch (the job URL itself) returns useful HTML
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => html })

    const result = await discoverAts('profile-1', jobUrl)

    expect(result.provider).toBe('greenhouse')
    expect(result.boardSlug).toBe('sonyinteractiveentertainmentglobal')
    // Job URL should be the first candidate fetched
    expect(mockFetch).toHaveBeenCalledWith(jobUrl, expect.anything())
    expect(mockLLM).not.toHaveBeenCalled()
  })

  it('detects SAP SuccessFactors from career page URL in HTML without LLM', async () => {
    const html = '<html><a href="https://career4.successfactors.com/careers?company=bentleyprod">Apply</a></html>'
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => html })

    const result = await discoverAts('profile-1', 'https://bentley.com')

    expect(mockLLM).not.toHaveBeenCalled()
    expect(result.provider).toBe('successfactors')
    expect(result.boardSlug).toBe('bentleyprod')
  })

  it('falls back to origin when job URL returns no useful HTML', async () => {
    const jobUrl = 'https://careers.example.com/role/job/999'
    const origin = 'https://careers.example.com'
    const html = '<html><a href="https://jobs.lever.co/example">View all jobs</a></html>'

    // Job URL returns 404, origin returns the useful HTML
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })   // jobUrl
      .mockResolvedValueOnce({ ok: true, text: async () => html })  // origin

    const result = await discoverAts('profile-1', jobUrl)

    expect(result.provider).toBe('lever')
    expect(result.boardSlug).toBe('example')
    expect(mockFetch).toHaveBeenCalledWith(origin, expect.anything())
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
