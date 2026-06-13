import { describe, it, expect } from 'vitest'
import {
  BOARD_PROVIDERS,
  JobHuntSearchCriteriaSchema,
  BoardJobListingSchema,
  normalizeJobHuntSearch,
} from './schema'

describe('BOARD_PROVIDERS', () => {
  it('includes all four initial providers', () => {
    expect(BOARD_PROVIDERS).toContain('remotive')
    expect(BOARD_PROVIDERS).toContain('remoteok')
    expect(BOARD_PROVIDERS).toContain('adzuna')
    expect(BOARD_PROVIDERS).toContain('jsearch')
  })
})

describe('JobHuntSearchCriteriaSchema', () => {
  it('accepts a full valid criteria object', () => {
    const r = JobHuntSearchCriteriaSchema.safeParse({
      roles: ['Engineering Manager', 'Operations Manager'],
      locations: ['Ireland', 'Remote'],
      datePosted: 'last30',
      minSalary: 90000,
    })
    expect(r.success).toBe(true)
  })

  it('accepts null minSalary', () => {
    const r = JobHuntSearchCriteriaSchema.safeParse({
      roles: ['Engineer'],
      locations: [],
      datePosted: 'any',
      minSalary: null,
    })
    expect(r.success).toBe(true)
  })

  it('rejects invalid datePosted value', () => {
    const r = JobHuntSearchCriteriaSchema.safeParse({
      roles: [],
      locations: [],
      datePosted: 'yesterday',
      minSalary: null,
    })
    expect(r.success).toBe(false)
  })
})

describe('normalizeJobHuntSearch', () => {
  it('returns defaults when called with null', () => {
    const result = normalizeJobHuntSearch(null)
    expect(result.roles).toEqual([])
    expect(result.locations).toEqual([])
    expect(result.datePosted).toBe('last30')
    expect(result.minSalary).toBeNull()
  })

  it('returns parsed value when valid JSON passed', () => {
    const input = { roles: ['EM'], locations: ['IE'], datePosted: 'last7', minSalary: 80000 }
    const result = normalizeJobHuntSearch(input)
    expect(result.roles).toEqual(['EM'])
    expect(result.datePosted).toBe('last7')
  })
})

describe('BoardJobListingSchema', () => {
  it('accepts a full listing with salary', () => {
    const r = BoardJobListingSchema.safeParse({
      externalId: 'abc-123',
      title: 'Engineering Manager',
      company: 'Acme Corp',
      location: 'Dublin, Ireland',
      url: 'https://example.com/job/abc-123',
      postedAt: new Date(),
      salary: '$180,000 - $220,000',
    })
    expect(r.success).toBe(true)
  })

  it('accepts null optional fields', () => {
    const r = BoardJobListingSchema.safeParse({
      externalId: '1',
      title: 'Engineer',
      company: 'Co',
      location: null,
      url: 'https://x.com',
      postedAt: null,
      salary: null,
    })
    expect(r.success).toBe(true)
  })
})
