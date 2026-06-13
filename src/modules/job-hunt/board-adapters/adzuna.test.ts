import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchJobs, isAvailable, locationToCountryCode } from './adzuna'
import type { JobHuntSearchCriteria } from '../board-sources/schema'

const criteria: JobHuntSearchCriteria = {
  roles: ['Engineering Manager'],
  locations: ['Ireland'],
  datePosted: 'last30',
  minSalary: 90000,
}

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubEnv('ADZUNA_APP_ID', 'test-app-id')
  vi.stubEnv('ADZUNA_APP_KEY', 'test-app-key')
})

describe('isAvailable', () => {
  it('returns true when env vars are set', () => {
    expect(isAvailable()).toBe(true)
  })

  it('returns false when env vars are missing', () => {
    vi.stubEnv('ADZUNA_APP_ID', '')
    expect(isAvailable()).toBe(false)
  })
})

describe('locationToCountryCode', () => {
  it('maps Ireland to ie', () => expect(locationToCountryCode('Ireland')).toBe('ie'))
  it('maps UK / United Kingdom to gb', () => {
    expect(locationToCountryCode('United Kingdom')).toBe('gb')
    expect(locationToCountryCode('UK')).toBe('gb')
  })
  it('maps France to fr', () => expect(locationToCountryCode('France')).toBe('fr'))
  it('maps Remote to us as fallback', () => expect(locationToCountryCode('Remote')).toBe('us'))
  it('returns us for unknown strings', () => expect(locationToCountryCode('Narnia')).toBe('us'))
})

describe('fetchJobs (Adzuna)', () => {
  it('maps results to BoardJobListing shape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'adzuna-1',
            title: 'Engineering Manager',
            company: { display_name: 'TechCorp' },
            location: { display_name: 'Dublin, Ireland' },
            created: '2026-06-01T10:00:00Z',
            salary_min: 90000,
            salary_max: 130000,
            redirect_url: 'https://adzuna.ie/jobs/details/adzuna-1',
          },
        ],
      }),
    })
    const jobs = await fetchJobs(criteria)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      externalId: 'ie-adzuna-1',
      title: 'Engineering Manager',
      company: 'TechCorp',
      location: 'Dublin, Ireland',
    })
    expect(jobs[0].salary).toBe('€90,000 – €130,000')
    expect(jobs[0].postedAt).toBeInstanceOf(Date)
  })

  it('deduplicates jobs appearing in multiple country results', async () => {
    const job = {
      id: 'shared-1',
      title: 'EM',
      company: { display_name: 'Co' },
      location: { display_name: 'Remote' },
      created: '2026-06-01T00:00:00Z',
      salary_min: null,
      salary_max: null,
      redirect_url: 'https://adzuna.com/jobs/1',
    }
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [job] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [job] }) })

    const multiCriteria: JobHuntSearchCriteria = {
      ...criteria,
      locations: ['Ireland', 'United Kingdom'],
    }
    const jobs = await fetchJobs(multiCriteria)
    // same id from two countries → two distinct externalIds (ie-shared-1, gb-shared-1)
    expect(jobs).toHaveLength(2)
  })

  it('skips a country request that fails and continues with others', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            id: '2', title: 'EM', company: { display_name: 'Co' },
            location: { display_name: 'London' }, created: '2026-06-01T00:00:00Z',
            salary_min: null, salary_max: null, redirect_url: 'https://adzuna.co.uk/jobs/2',
          }],
        }),
      })

    const multiCriteria: JobHuntSearchCriteria = {
      ...criteria,
      locations: ['Ireland', 'United Kingdom'],
    }
    const jobs = await fetchJobs(multiCriteria)
    expect(jobs).toHaveLength(1)
  })
})
