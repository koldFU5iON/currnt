import { describe, it, expect } from 'vitest'
import { cleanJobUrl, parseUrlsFromText } from './batch-capture'

describe('cleanJobUrl', () => {
  it('strips utm_* tracking params', () => {
    expect(cleanJobUrl('https://example.com/job?utm_source=gh&utm_campaign=spring'))
      .toBe('https://example.com/job')
  })

  it('strips fbclid and gclid', () => {
    expect(cleanJobUrl('https://example.com/job?fbclid=abc123&gclid=xyz'))
      .toBe('https://example.com/job')
  })

  it('preserves gh_jid ATS param', () => {
    expect(cleanJobUrl('https://acme.com/careers?gh_jid=12345&utm_source=web'))
      .toBe('https://acme.com/careers?gh_jid=12345')
  })

  it('preserves lever-origin ATS param', () => {
    expect(cleanJobUrl('https://jobs.lever.co/acme/abc?lever-origin=applied&utm_medium=email'))
      .toBe('https://jobs.lever.co/acme/abc?lever-origin=applied')
  })

  it('returns the raw string unchanged for invalid URLs', () => {
    expect(cleanJobUrl('not-a-url')).toBe('not-a-url')
  })

  it('preserves non-tracking query params', () => {
    expect(cleanJobUrl('https://example.com/job?id=123&tab=overview'))
      .toBe('https://example.com/job?id=123&tab=overview')
  })
})

describe('parseUrlsFromText', () => {
  it('extracts newline-delimited URLs', () => {
    const text = 'https://jobs.lever.co/acme/abc\nhttps://boards.greenhouse.io/acme/jobs/123'
    expect(parseUrlsFromText(text)).toHaveLength(2)
  })

  it('extracts comma-delimited URLs', () => {
    const text = 'https://jobs.lever.co/acme/abc, https://boards.greenhouse.io/acme/jobs/123'
    expect(parseUrlsFromText(text)).toHaveLength(2)
  })

  it('extracts URLs embedded in surrounding text', () => {
    const text = 'Check this out: https://example.com/jobs/123. Looks good!'
    const result = parseUrlsFromText(text)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('https://example.com/jobs/123')
  })

  it('strips utm params from extracted URLs', () => {
    const result = parseUrlsFromText('https://jobs.lever.co/acme/abc?utm_source=linkedin')
    expect(result[0]).toBe('https://jobs.lever.co/acme/abc')
  })

  it('deduplicates identical cleaned URLs', () => {
    const text = 'https://example.com/jobs/1\nhttps://example.com/jobs/1?utm_source=a'
    expect(parseUrlsFromText(text)).toHaveLength(1)
  })

  it('caps results at 50 URLs', () => {
    const text = Array.from({ length: 60 }, (_, i) => `https://example.com/jobs/${i}`).join('\n')
    expect(parseUrlsFromText(text)).toHaveLength(50)
  })

  it('returns empty array for text with no URLs', () => {
    expect(parseUrlsFromText('No links here at all')).toHaveLength(0)
  })
})
