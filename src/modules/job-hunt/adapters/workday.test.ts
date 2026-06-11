import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => { mockFetch.mockReset() })

import { fetchJobList, fetchDescription } from './workday'

describe('fetchJobList', () => {
  it('POSTs to the correct Workday jobs API URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        total: 1,
        jobPostings: [{
          title: 'Senior Software Engineer',
          externalPath: '/Logitech/job/Lausanne-CHE/Senior-Software-Engineer_JR-001',
          locationsText: 'Lausanne, Switzerland',
          postedOn: 'Posted 5 Days Ago',
        }],
      }),
    })

    const jobs = await fetchJobList('logitech.wd5/Logitech')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://logitech.wd5.myworkdayjobs.com/wday/cxs/logitech/Logitech/jobs',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(jobs).toHaveLength(1)
    expect(jobs[0].title).toBe('Senior Software Engineer')
    expect(jobs[0].location).toBe('Lausanne, Switzerland')
    expect(jobs[0].externalId).toBe('/Logitech/job/Lausanne-CHE/Senior-Software-Engineer_JR-001')
    expect(jobs[0].url).toBe('https://logitech.wd5.myworkdayjobs.com/Logitech/job/Lausanne-CHE/Senior-Software-Engineer_JR-001')
  })

  it('throws when the API returns a non-200 status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
    await expect(fetchJobList('logitech.wd5/Logitech')).rejects.toThrow('Workday returned 403')
  })

  it('parses "Posted X Days Ago" into an approximate date', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobPostings: [{
          title: 'PM',
          externalPath: '/Board/job/London/PM_JR-002',
          locationsText: 'London',
          postedOn: 'Posted 10 Days Ago',
        }],
      }),
    })

    const [job] = await fetchJobList('company.wd3/Board')
    expect(job.postedAt).toBeInstanceOf(Date)
    const diffDays = Math.round((Date.now() - job.postedAt!.getTime()) / 86_400_000)
    expect(diffDays).toBeGreaterThanOrEqual(10)
  })

  it('parses "Posted 30+ Days Ago" using the lower bound', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobPostings: [{
          title: 'Old Role',
          externalPath: '/Board/job/Remote/Old-Role_JR-003',
          locationsText: 'Remote',
          postedOn: 'Posted 30+ Days Ago',
        }],
      }),
    })

    const [job] = await fetchJobList('company.wd3/Board')
    expect(job.postedAt).toBeInstanceOf(Date)
    const diffDays = Math.round((Date.now() - job.postedAt!.getTime()) / 86_400_000)
    expect(diffDays).toBeGreaterThanOrEqual(30)
  })

  it('returns an empty array when jobPostings is absent', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ total: 0 }) })
    const jobs = await fetchJobList('logitech.wd5/Logitech')
    expect(jobs).toEqual([])
  })
})

describe('fetchDescription', () => {
  it('fetches description from the Workday job detail API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobPostingInfo: { jobDescription: '<p>Great role</p>' },
      }),
    })

    const desc = await fetchDescription(
      'logitech.wd5/Logitech',
      '/Logitech/job/Lausanne-CHE/Senior-Software-Engineer_JR-001',
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://logitech.wd5.myworkdayjobs.com/wday/cxs/logitech/Logitech/job/Lausanne-CHE/Senior-Software-Engineer_JR-001',
      expect.anything(),
    )
    expect(desc).toBe('<p>Great role</p>')
  })

  it('returns null when the description API returns non-200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    const desc = await fetchDescription('logitech.wd5/Logitech', '/Logitech/job/X/Y_Z')
    expect(desc).toBeNull()
  })
})
