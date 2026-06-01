import { describe, it, expect } from 'vitest'
import { decodeEntities, formatSalaryBand } from './extract-utils'

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
