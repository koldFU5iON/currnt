import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchJobs, isAvailable } from './jsearch'
import type { JobHuntSearchCriteria } from '../board-sources/schema'

const criteria: JobHuntSearchCriteria = {
  roles: ['Engineering Manager'],
  locations: ['Ireland'],
  datePosted: 'last30',
  minSalary: null,
}

beforeEach(() => mockFetch.mockReset())

describe('isAvailable', () => {
  it('returns true when apiKey is provided', () => {
    expect(isAvailable('rapidapi-key-abc')).toBe(true)
  })

  it('returns false when apiKey is null', () => {
    expect(isAvailable(null)).toBe(false)
  })
})

describe('fetchJobs (JSearch)', () => {
  it('maps results to BoardJobListing shape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            job_id: 'jsearch-abc-123',
            job_title: 'Engineering Manager',
            employer_name: 'GlobalCorp',
            job_city: 'Dublin',
            job_country: 'Ireland',
            job_apply_link: 'https://linkedin.com/jobs/view/123',
            job_posted_at_datetime_utc: '2026-06-01T09:00:00Z',
            job_min_salary: 100000,
            job_max_salary: 140000,
          },
        ],
      }),
    })
    const jobs = await fetchJobs(criteria, 'test-key')
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      externalId: 'jsearch-abc-123',
      title: 'Engineering Manager',
      company: 'GlobalCorp',
      url: 'https://linkedin.com/jobs/view/123',
    })
    expect(jobs[0].postedAt).toBeInstanceOf(Date)
    expect(jobs[0].salary).toMatch(/100,000/)
  })

  it('handles missing salary and city', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{
          job_id: '1', job_title: 'Dev', employer_name: 'Co',
          job_city: null, job_country: 'Remote',
          job_apply_link: 'https://linkedin.com/jobs/view/999',
          job_posted_at_datetime_utc: null,
          job_min_salary: null, job_max_salary: null,
        }],
      }),
    })
    const jobs = await fetchJobs(criteria, 'test-key')
    expect(jobs[0].salary).toBeNull()
    expect(jobs[0].location).toBe('Remote')
  })

  it('throws key_invalid on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(fetchJobs(criteria, 'bad-key')).rejects.toThrow('key_invalid')
  })

  it('throws key_invalid on 403', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
    await expect(fetchJobs(criteria, 'bad-key')).rejects.toThrow('key_invalid')
  })

  it('throws generic error on other non-ok responses', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(fetchJobs(criteria, 'test-key')).rejects.toThrow('JSearch returned 503')
  })

  it('makes separate requests per role', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    await fetchJobs({ ...criteria, roles: ['EM', 'PM'] }, 'test-key')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
