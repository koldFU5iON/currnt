import { describe, it, expect } from 'vitest'
import { decodeEntities, formatSalaryBand, scoreCompleteness, mergeExtractedJob } from './extract-utils'

describe('decodeEntities', () => {
  it('decodes named entities', () => {
    expect(decodeEntities('&lt;p&gt;Hello &amp; world&lt;/p&gt;')).toBe('<p>Hello & world</p>')
  })
  it('decodes numeric decimal entities', () => {
    expect(decodeEntities('&#169;')).toBe('©')
  })
  it('decodes numeric hex entities', () => {
    expect(decodeEntities('&#x00A9;')).toBe('©')
  })
  it('decodes &amp; last to avoid double-decoding', () => {
    expect(decodeEntities('&amp;lt;')).toBe('&lt;')
  })
  it('decodes emoji numeric entities (above U+FFFF)', () => {
    expect(decodeEntities('&#128512;')).toBe('😀')
  })
})

describe('formatSalaryBand', () => {
  it('formats a min/max range', () => {
    expect(formatSalaryBand({ currency: 'USD', value: { minValue: 120000, maxValue: 160000 } })).toBe('$120k–$160k')
  })
  it('formats a flat value', () => {
    expect(formatSalaryBand({ currency: 'USD', value: { value: 100000 } })).toBe('$100k')
  })
  it('uses GBP symbol', () => {
    expect(formatSalaryBand({ currency: 'GBP', value: { minValue: 80000, maxValue: 100000 } })).toBe('£80k–£100k')
  })
  it('returns undefined for non-object input', () => {
    expect(formatSalaryBand(null)).toBeUndefined()
    expect(formatSalaryBand('$100k')).toBeUndefined()
  })
})

describe('scoreCompleteness', () => {
  it('returns 0 for an empty object', () => {
    expect(scoreCompleteness({})).toBe(0)
  })

  it('returns 0.25 for title only', () => {
    expect(scoreCompleteness({ title: 'Engineer' })).toBe(0.25)
  })

  it('returns 0.50 for title + company', () => {
    expect(scoreCompleteness({ title: 'Engineer', company: 'Acme' })).toBe(0.50)
  })

  it('returns 0.90 for title + company + description', () => {
    expect(scoreCompleteness({ title: 'Engineer', company: 'Acme', jobDescription: 'Build things.' })).toBe(0.90)
  })

  it('returns 1.0 for all key fields present', () => {
    expect(scoreCompleteness({
      title: 'Engineer', company: 'Acme', jobDescription: 'Build things.', location: 'Remote',
    })).toBe(1.0)
  })

  it('awards the extra 0.10 for salaryBand when title/company/description missing', () => {
    expect(scoreCompleteness({ salaryBand: '$100k' })).toBe(0.10)
  })
})

describe('mergeExtractedJob', () => {
  it('base values are never overwritten by overlay', () => {
    const result = mergeExtractedJob(
      { title: 'Senior Engineer', company: 'Acme' },
      { title: 'Junior Engineer', company: 'Other', location: 'Remote' },
    )
    expect(result.title).toBe('Senior Engineer')
    expect(result.company).toBe('Acme')
    expect(result.location).toBe('Remote')
  })

  it('overlay fills undefined fields from base', () => {
    const result = mergeExtractedJob(
      { title: 'Engineer' },
      { company: 'Acme', jobDescription: 'Build things.' },
    )
    expect(result.company).toBe('Acme')
    expect(result.jobDescription).toBe('Build things.')
  })

  it('undefined overlay fields do not clobber defined base fields', () => {
    const result = mergeExtractedJob(
      { title: 'Engineer', company: 'Acme' },
      { title: undefined },
    )
    expect(result.title).toBe('Engineer')
  })

  it('merging two empty objects returns an empty object', () => {
    expect(mergeExtractedJob({}, {})).toEqual({
      title: undefined, company: undefined, location: undefined,
      jobDescription: undefined, jobNumber: undefined, datePublished: undefined, salaryBand: undefined,
    })
  })
})
