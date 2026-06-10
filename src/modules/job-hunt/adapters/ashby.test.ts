import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchJobList } from './ashby'

beforeEach(() => { mockFetch.mockReset() })

describe('fetchJobList (Ashby)', () => {
  it('maps published postings to JobListing shape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobPostings: [
          {
            id: 'uuid-1',
            title: 'Product Manager',
            jobPostingState: 'Published',
            isRemote: true,
            locationName: 'New York',
            externalLink: 'https://jobs.ashbyhq.com/acme/uuid-1',
            publishedDate: '2026-03-01',
          },
        ],
      }),
    })

    const listings = await fetchJobList('acme')
    expect(listings).toHaveLength(1)
    expect(listings[0]).toMatchObject({
      externalId: 'uuid-1',
      title: 'Product Manager',
      location: 'Remote',
      url: 'https://jobs.ashbyhq.com/acme/uuid-1',
    })
  })

  it('filters out non-published postings', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobPostings: [
          { id: '1', title: 'Engineer', jobPostingState: 'Draft', isRemote: false, locationName: 'London', externalLink: 'https://jobs.ashbyhq.com/acme/1', publishedDate: '2026-01-01' },
        ],
      }),
    })
    const listings = await fetchJobList('acme')
    expect(listings).toHaveLength(0)
  })

  it('uses locationName when not remote', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobPostings: [
          { id: '1', title: 'Designer', jobPostingState: 'Published', isRemote: false, locationName: 'Berlin', externalLink: 'https://jobs.ashbyhq.com/acme/1', publishedDate: null },
        ],
      }),
    })
    const listings = await fetchJobList('acme')
    expect(listings[0].location).toBe('Berlin')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchJobList('unknown')).rejects.toThrow('Ashby returned 404')
  })
})
