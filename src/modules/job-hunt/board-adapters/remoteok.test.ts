import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchJobs, isAvailable } from './remoteok'
import type { JobHuntSearchCriteria } from '../board-sources/schema'

const criteria: JobHuntSearchCriteria = {
  roles: ['Engineering Manager'],
  locations: ['Remote'],
  datePosted: 'last30',
  minSalary: null,
}

beforeEach(() => mockFetch.mockReset())

describe('isAvailable', () => {
  it('returns true', () => {
    expect(isAvailable()).toBe(true)
  })
})

describe('fetchJobs (RemoteOK)', () => {
  it('skips the first metadata element and maps jobs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { legal: 'metadata object — skip me' },
        {
          id: 'remoteok-job-1',
          url: 'https://remoteok.com/jobs/1',
          position: 'Engineering Manager',
          company: 'StartupCo',
          location: 'Worldwide',
          salary_min: 150000,
          salary_max: 200000,
          date: '2026-06-01T00:00:00Z',
        },
      ]),
    })
    const jobs = await fetchJobs(criteria)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      externalId: 'remoteok-job-1',
      title: 'Engineering Manager',
      company: 'StartupCo',
      location: 'Worldwide',
    })
    expect(jobs[0].salary).toBe('$150,000 – $200,000')
  })

  it('handles missing salary fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { legal: 'skip' },
        { id: '2', url: 'https://remoteok.com/jobs/2', position: 'Dev', company: 'Co', location: '', date: null },
      ]),
    })
    const jobs = await fetchJobs(criteria)
    expect(jobs[0].salary).toBeNull()
    expect(jobs[0].location).toBeNull()
    expect(jobs[0].postedAt).toBeNull()
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })
    await expect(fetchJobs(criteria)).rejects.toThrow('RemoteOK returned 429')
  })
})
