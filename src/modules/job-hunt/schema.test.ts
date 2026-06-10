// src/modules/job-hunt/schema.test.ts
import { describe, it, expect } from 'vitest'
import {
  ATS_PROVIDERS,
  DISCOVERED_JOB_STATUSES,
  JobListingSchema,
  AtsDiscoveryResultSchema,
  ScanResultSchema,
} from './schema'

describe('ATS_PROVIDERS', () => {
  it('includes the three supported providers', () => {
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
      provider: 'workday',
      confidence: 0.5,
      reasoning: 'test',
    })
    expect(r.success).toBe(false)
  })
})
