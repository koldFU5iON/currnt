import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchJobs, isAvailable } from './remotive'
import type { JobHuntSearchCriteria } from '../board-sources/schema'

const criteria: JobHuntSearchCriteria = {
  roles: ['Engineering Manager'],
  locations: ['Remote'],
  datePosted: 'last30',
  minSalary: null,
}

beforeEach(() => mockFetch.mockReset())

describe('isAvailable', () => {
  it('returns true — no auth required', () => {
    expect(isAvailable()).toBe(true)
  })
})

describe('fetchJobs (Remotive)', () => {
  it('maps response to BoardJobListing shape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          {
            id: 42,
            url: 'https://remotive.com/job/42',
            title: 'Engineering Manager',
            company_name: 'Acme',
            candidate_required_location: 'Worldwide',
            salary: '$180,000',
            publication_date: '2026-06-01T10:00:00Z',
          },
        ],
      }),
    })
    const jobs = await fetchJobs(criteria)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      externalId: '42',
      title: 'Engineering Manager',
      company: 'Acme',
      location: 'Worldwide',
      url: 'https://remotive.com/job/42',
      salary: '$180,000',
    })
    expect(jobs[0].postedAt).toBeInstanceOf(Date)
  })

  it('returns empty array for empty salary string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          {
            id: 1,
            url: 'https://remotive.com/job/1',
            title: 'Engineer',
            company_name: 'Co',
            candidate_required_location: 'Remote',
            salary: '',
            publication_date: null,
          },
        ],
      }),
    })
    const jobs = await fetchJobs(criteria)
    expect(jobs[0].salary).toBeNull()
    expect(jobs[0].postedAt).toBeNull()
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(fetchJobs(criteria)).rejects.toThrow('Remotive returned 503')
  })
})
