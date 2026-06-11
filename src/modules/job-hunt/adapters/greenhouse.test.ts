import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/modules/jobs/extract-ats', () => ({
  extractGreenhouse: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchJobList } from './greenhouse'
import { extractGreenhouse } from '@/modules/jobs/extract-ats'
const mockExtract = vi.mocked(extractGreenhouse)

beforeEach(() => { mockFetch.mockReset() })

describe('fetchJobList (Greenhouse)', () => {
  it('maps the jobs array to JobListing shape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          {
            id: 4022062002,
            title: 'Engineering Manager',
            location: { name: 'Remote, USA' },
            absolute_url: 'https://boards.greenhouse.io/acme/jobs/4022062002',
            first_published: '2026-01-15T10:00:00.000Z',
          },
        ],
      }),
    })

    const listings = await fetchJobList('acme')

    expect(listings).toHaveLength(1)
    expect(listings[0]).toMatchObject({
      externalId: '4022062002',
      title: 'Engineering Manager',
      location: 'Remote, USA',
      url: 'https://boards.greenhouse.io/acme/jobs/4022062002',
    })
    expect(listings[0].postedAt).toBeInstanceOf(Date)
  })

  it('handles null location and missing first_published', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [{ id: 1, title: 'Engineer', location: null, absolute_url: 'https://boards.greenhouse.io/acme/jobs/1', first_published: null }],
      }),
    })
    const listings = await fetchJobList('acme')
    expect(listings[0].location).toBeNull()
    expect(listings[0].postedAt).toBeNull()
  })

  it('throws when the API returns an error status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchJobList('unknown-board')).rejects.toThrow('Greenhouse returned 404')
  })
})

describe('fetchDescription (Greenhouse)', () => {
  it('returns job description on success', async () => {
    mockExtract.mockResolvedValueOnce({ ok: true, data: { jobDescription: 'We are hiring...' } } as never)
    const { fetchDescription } = await import('./greenhouse')
    const result = await fetchDescription('acme', '12345')
    expect(result).toBe('We are hiring...')
  })

  it('returns null when extraction fails', async () => {
    mockExtract.mockResolvedValueOnce({ ok: false, error: 'not found' } as never)
    const { fetchDescription } = await import('./greenhouse')
    const result = await fetchDescription('acme', 'bad-id')
    expect(result).toBeNull()
  })
})

describe('getAdapter', () => {
  it('returns null for unknown provider', async () => {
    const { getAdapter } = await import('./index')
    expect(getAdapter('workday')).toBeNull()
    expect(getAdapter('linkedin')).toBeNull()
  })
})
