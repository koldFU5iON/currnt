// src/modules/job-hunt/schema.test.ts
import { describe, it, expect } from 'vitest'
import {
  ATS_PROVIDERS,
  COMPANY_WATCH_STATUSES,
  DISCOVERED_JOB_STATUSES,
  JobListingSchema,
  AtsDiscoveryResultSchema,
  AddCompanyInputSchema,
  AtsHintSchema,
  ScanResultSchema,
} from './schema'

describe('ATS_PROVIDERS', () => {
  it('contains greenhouse, lever, ashby, and the unknown sentinel', () => {
    expect(ATS_PROVIDERS).toContain('greenhouse')
    expect(ATS_PROVIDERS).toContain('lever')
    expect(ATS_PROVIDERS).toContain('ashby')
    expect(ATS_PROVIDERS).toContain('unknown')
  })
})

describe('DISCOVERED_JOB_STATUSES', () => {
  it('covers the full lifecycle', () => {
    expect(DISCOVERED_JOB_STATUSES).toContain('new')
    expect(DISCOVERED_JOB_STATUSES).toContain('scored')
    expect(DISCOVERED_JOB_STATUSES).toContain('imported')
    expect(DISCOVERED_JOB_STATUSES).toContain('ignored')
  })
})

describe('JobListingSchema', () => {
  it('accepts a complete listing', () => {
    const r = JobListingSchema.safeParse({
      externalId: '12345',
      title: 'Senior Engineer',
      location: 'Remote',
      url: 'https://boards.greenhouse.io/acme/jobs/12345',
      postedAt: new Date(),
    })
    expect(r.success).toBe(true)
  })

  it('accepts null location and postedAt', () => {
    const r = JobListingSchema.safeParse({
      externalId: '1',
      title: 'Engineer',
      location: null,
      url: 'https://example.com',
      postedAt: null,
    })
    expect(r.success).toBe(true)
  })

  it('accepts null url', () => {
    const r = JobListingSchema.safeParse({
      externalId: '1',
      title: 'Engineer',
      location: null,
      url: null,
      postedAt: null,
    })
    expect(r.success).toBe(true)
  })
})

describe('AtsDiscoveryResultSchema', () => {
  it('accepts a successful discovery', () => {
    const r = AtsDiscoveryResultSchema.safeParse({
      provider: 'greenhouse',
      boardSlug: 'mongodb',
      careersUrl: 'https://boards.greenhouse.io/mongodb',
      confidence: 0.94,
      reasoning: 'Found greenhouse embed script',
    })
    expect(r.success).toBe(true)
  })

  it('accepts unknown provider', () => {
    const r = AtsDiscoveryResultSchema.safeParse({
      provider: 'unknown',
      confidence: 0,
      reasoning: 'No ATS detected',
    })
    expect(r.success).toBe(true)
  })

  it('rejects invalid provider', () => {
    const r = AtsDiscoveryResultSchema.safeParse({
      provider: 'taleo',
      confidence: 0.5,
      reasoning: 'test',
    })
    expect(r.success).toBe(false)
  })

  it('rejects confidence outside 0–1', () => {
    const r = AtsDiscoveryResultSchema.safeParse({ provider: 'greenhouse', confidence: 1.5, reasoning: 'test' })
    expect(r.success).toBe(false)
  })
})

describe('COMPANY_WATCH_STATUSES', () => {
  it('contains all expected statuses', () => {
    expect(COMPANY_WATCH_STATUSES).toContain('active')
    expect(COMPANY_WATCH_STATUSES).toContain('paused')
    expect(COMPANY_WATCH_STATUSES).toContain('discovery_failed')
    expect(COMPANY_WATCH_STATUSES).toHaveLength(3)
  })
})

describe('AddCompanyInputSchema', () => {
  it('accepts valid name and website', () => {
    const r = AddCompanyInputSchema.safeParse({
      name: 'Acme Corp',
      website: 'https://acme.com',
    })
    expect(r.success).toBe(true)
  })

  it('rejects missing name', () => {
    const r = AddCompanyInputSchema.safeParse({
      website: 'https://acme.com',
    })
    expect(r.success).toBe(false)
  })

  it('rejects invalid URL', () => {
    const r = AddCompanyInputSchema.safeParse({
      name: 'Acme Corp',
      website: 'not-a-url',
    })
    expect(r.success).toBe(false)
  })
})

describe('ScanResultSchema', () => {
  it('accepts a success result', () => {
    const r = ScanResultSchema.safeParse({ ok: true, found: 10, matched: 3, newJobs: 2 })
    expect(r.success).toBe(true)
  })

  it('accepts a failure result with each error code', () => {
    for (const error of ['not_found', 'no_ats_detected', 'fetch_failed'] as const) {
      const r = ScanResultSchema.safeParse({ ok: false, error })
      expect(r.success).toBe(true)
    }
  })

  it('rejects unknown error codes', () => {
    const r = ScanResultSchema.safeParse({ ok: false, error: 'other_error' })
    expect(r.success).toBe(false)
  })
})

describe('AtsHintSchema', () => {
  it('accepts greenhouse provider', () => {
    const r = AtsHintSchema.safeParse({
      provider: 'greenhouse',
      boardSlug: 'acme',
      name: 'Acme Corp',
    })
    expect(r.success).toBe(true)
  })

  it('accepts lever provider', () => {
    const r = AtsHintSchema.safeParse({
      provider: 'lever',
      boardSlug: 'acme',
      name: 'Acme Corp',
    })
    expect(r.success).toBe(true)
  })

  it('accepts ashby provider', () => {
    const r = AtsHintSchema.safeParse({
      provider: 'ashby',
      boardSlug: 'acme',
      name: 'Acme Corp',
    })
    expect(r.success).toBe(true)
  })

  it('rejects unknown provider', () => {
    const r = AtsHintSchema.safeParse({
      provider: 'unknown',
      boardSlug: 'acme',
      name: 'Acme Corp',
    })
    expect(r.success).toBe(false)
  })
})
