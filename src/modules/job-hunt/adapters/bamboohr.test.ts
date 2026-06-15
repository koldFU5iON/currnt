import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchJobList } from './bamboohr'

beforeEach(() => mockFetch.mockReset())

describe('fetchJobList (BambooHR)', () => {
  it('maps open jobs to JobListing shape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          id: '1507',
          title: 'Senior Software Engineer',
          status: 'Open',
          location: { city: 'Dublin', state: '', country: 'Ireland', isRemote: false },
        },
        {
          id: '1508',
          title: 'QA Engineer',
          status: 'Open',
          location: { isRemote: true },
        },
      ]),
    })

    const jobs = await fetchJobList('waystone')
    expect(jobs).toHaveLength(2)
    expect(jobs[0]).toMatchObject({
      externalId: '1507',
      title: 'Senior Software Engineer',
      location: 'Dublin, Ireland',
      url: 'https://waystone.bamboohr.com/careers/1507',
    })
    expect(jobs[1].location).toBe('Remote')
    expect(jobs[0].postedAt).toBeNull()
  })

  it('filters out non-Open jobs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { id: '1', title: 'Open Role', status: 'Open', location: {} },
        { id: '2', title: 'Closed Role', status: 'Filled', location: {} },
      ]),
    })
    const jobs = await fetchJobList('acme')
    expect(jobs).toHaveLength(1)
    expect(jobs[0].externalId).toBe('1')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchJobList('notacompany')).rejects.toThrow('BambooHR returned 404')
  })
})
