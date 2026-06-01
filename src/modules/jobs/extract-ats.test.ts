import { describe, it, expect } from 'vitest'
import {
  linkedInJobId,
  greenhouseFromUrl,
  greenhouseFromHtml,
  matchSiteOverride,
  leverFromUrl,
  ashbyFromUrl,
  workdayFromUrl,
} from './extract-ats'

describe('linkedInJobId', () => {
  it('extracts job ID from /jobs/view/{id}', () => {
    expect(linkedInJobId('https://www.linkedin.com/jobs/view/4219034985')).toBe('4219034985')
  })
  it('extracts job ID from /jobs/view/{slug}-{id}', () => {
    expect(linkedInJobId('https://www.linkedin.com/jobs/view/senior-engineer-4219034985')).toBe('4219034985')
  })
  it('returns null for non-LinkedIn URLs', () => {
    expect(linkedInJobId('https://example.com/jobs/123')).toBeNull()
  })
})

describe('greenhouseFromUrl', () => {
  it('matches boards.greenhouse.io URLs', () => {
    expect(greenhouseFromUrl('https://boards.greenhouse.io/acme/jobs/12345')).toEqual({ board: 'acme', jobId: '12345' })
  })
  it('matches job-boards.greenhouse.io URLs', () => {
    expect(greenhouseFromUrl('https://job-boards.greenhouse.io/acme/jobs/12345')).toEqual({ board: 'acme', jobId: '12345' })
  })
  it('returns null for non-Greenhouse URLs', () => {
    expect(greenhouseFromUrl('https://stripe.com/jobs/listing/engineer/7790430')).toBeNull()
  })
})

describe('matchSiteOverride', () => {
  it('matches Stripe job URLs and returns Greenhouse board + jobId', () => {
    expect(matchSiteOverride('https://stripe.com/jobs/listing/sales-strategy/7790430')).toEqual({
      board: 'stripe',
      jobId: '7790430',
    })
  })
  it('returns null for non-override URLs', () => {
    expect(matchSiteOverride('https://lever.co/acme/jobs/abc')).toBeNull()
  })
})

describe('leverFromUrl', () => {
  it('matches jobs.lever.co URLs', () => {
    expect(leverFromUrl('https://jobs.lever.co/acme/550e8400-e29b-41d4-a716-446655440000')).toEqual({
      company: 'acme',
      jobId: '550e8400-e29b-41d4-a716-446655440000',
    })
  })
  it('returns null for non-Lever URLs', () => {
    expect(leverFromUrl('https://jobs.ashbyhq.com/acme/some-job')).toBeNull()
  })
})

describe('ashbyFromUrl', () => {
  it('matches jobs.ashbyhq.com URLs', () => {
    expect(ashbyFromUrl('https://jobs.ashbyhq.com/acme/senior-engineer')).toEqual({
      company: 'acme',
      jobSlug: 'senior-engineer',
    })
  })
  it('matches URL with UUID slug', () => {
    expect(ashbyFromUrl('https://jobs.ashbyhq.com/acme/550e8400-e29b-41d4-a716-446655440000')).toEqual({
      company: 'acme',
      jobSlug: '550e8400-e29b-41d4-a716-446655440000',
    })
  })
  it('returns null for non-Ashby URLs', () => {
    expect(ashbyFromUrl('https://jobs.lever.co/acme/abc')).toBeNull()
  })
})

describe('greenhouseFromHtml', () => {
  it('extracts board from embed script and jobId from gh_jid param', () => {
    const html = '<script src="https://boards.greenhouse.io/embed/job_board/js?for=acme"></script>'
    const url = 'https://acme.com/careers?gh_jid=12345'
    expect(greenhouseFromHtml(url, html)).toEqual({ board: 'acme', jobId: '12345' })
  })

  it('falls back to job ID from URL path', () => {
    const html = '<script src="https://boards.greenhouse.io/embed/job_board/js?for=acme"></script>'
    const url = 'https://acme.com/jobs/12345'
    expect(greenhouseFromHtml(url, html)).toEqual({ board: 'acme', jobId: '12345' })
  })

  it('returns null when no Greenhouse embed script in HTML', () => {
    expect(greenhouseFromHtml('https://acme.com/jobs/123', '<html><body>No embed</body></html>')).toBeNull()
  })

  it('returns null when board found but no job ID can be determined', () => {
    const html = '<script src="https://boards.greenhouse.io/embed/job_board/js?for=acme"></script>'
    expect(greenhouseFromHtml('https://acme.com/careers', html)).toBeNull()
  })
})

describe('workdayFromUrl', () => {
  it('matches standard Workday URLs', () => {
    const result = workdayFromUrl(
      'https://amazon.wd5.myworkdayjobs.com/en-US/External_Marketplace_Career_Site/job/Seattle-WA/Software-Engineer_2287571',
    )
    expect(result).toEqual({
      subdomain: 'amazon.wd5',
      tenant: 'amazon',
      group: 'External_Marketplace_Career_Site',
      jobId: 'Seattle-WA',
    })
  })
  it('returns null for non-Workday URLs', () => {
    expect(workdayFromUrl('https://stripe.com/jobs/listing/engineer/123')).toBeNull()
  })
})
