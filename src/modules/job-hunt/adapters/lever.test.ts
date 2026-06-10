import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/modules/jobs/extract-ats', () => ({
  extractLever: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchJobList } from './lever'
import { extractLever } from '@/modules/jobs/extract-ats'
const mockExtract = vi.mocked(extractLever)

beforeEach(() => { mockFetch.mockReset() })

describe('fetchJobList (Lever)', () => {
  it('maps the postings array to JobListing shape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          id: 'abc-123',
          text: 'Senior Software Engineer',
          categories: { location: 'Dublin, Ireland' },
          hostedUrl: 'https://jobs.lever.co/acme/abc-123',
          createdAt: 1700000000000,
        },
      ]),
    })

    const listings = await fetchJobList('acme')
    expect(listings).toHaveLength(1)
    expect(listings[0]).toMatchObject({
      externalId: 'abc-123',
      title: 'Senior Software Engineer',
      location: 'Dublin, Ireland',
      url: 'https://jobs.lever.co/acme/abc-123',
    })
    expect(listings[0].postedAt).toBeInstanceOf(Date)
  })

  it('handles missing categories', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ id: '1', text: 'Engineer', hostedUrl: 'https://jobs.lever.co/acme/1', createdAt: null }]),
    })
    const listings = await fetchJobList('acme')
    expect(listings[0].location).toBeNull()
    expect(listings[0].postedAt).toBeNull()
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
    await expect(fetchJobList('acme')).rejects.toThrow('Lever returned 403')
  })
})

describe('fetchDescription (Lever)', () => {
  it('returns job description on success', async () => {
    mockExtract.mockResolvedValueOnce({ ok: true, data: { jobDescription: 'Join our team...' } } as never)
    const { fetchDescription } = await import('./lever')
    const result = await fetchDescription('acme', 'abc-123')
    expect(result).toBe('Join our team...')
  })

  it('returns null when extraction fails', async () => {
    mockExtract.mockResolvedValueOnce({ ok: false, error: 'not found' } as never)
    const { fetchDescription } = await import('./lever')
    const result = await fetchDescription('acme', 'bad-id')
    expect(result).toBeNull()
  })
})
