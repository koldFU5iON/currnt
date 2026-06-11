import { describe, it, expect } from 'vitest'
import { buildKeywords, matchesProfile, matchesLocation } from './profile-filter'

const baseProfile = {
  targetRole: '',
  currentRole: '',
  headline: '',
  experienceRoles: [] as string[],
  skillNames: [] as string[],
}

describe('buildKeywords', () => {
  it('derives keywords from targetRole', () => {
    const kw = buildKeywords({ ...baseProfile, targetRole: 'Engineering Manager' })
    expect(kw.some(k => k.includes('engineering') && k.includes('manager'))).toBe(true)
  })

  it('expands seniority ±2 steps from senior', () => {
    const kw = buildKeywords({ ...baseProfile, targetRole: 'Senior Software Engineer' })
    // senior itself
    expect(kw.some(k => k.includes('senior') && k.includes('software'))).toBe(true)
    // one step up → staff
    expect(kw.some(k => k.includes('staff') && k.includes('software'))).toBe(true)
    // two steps up → lead
    expect(kw.some(k => k.includes('lead') && k.includes('software'))).toBe(true)
    // one step down → mid
    expect(kw.some(k => k.includes('mid') && k.includes('software'))).toBe(true)
  })

  it('expands synonyms: engineer → developer', () => {
    const kw = buildKeywords({ ...baseProfile, targetRole: 'Senior Software Engineer' })
    expect(kw.some(k => k.includes('developer'))).toBe(true)
  })

  it('includes tech skill keywords', () => {
    const kw = buildKeywords({ ...baseProfile, skillNames: ['TypeScript', 'Node.js'] })
    expect(kw).toContain('typescript')
    expect(kw).toContain('node.js')
  })

  it('includes experience role titles', () => {
    const kw = buildKeywords({ ...baseProfile, experienceRoles: ['Staff Product Manager'] })
    expect(kw.some(k => k.includes('product') && k.includes('manager'))).toBe(true)
  })

  it('deduplicates keywords', () => {
    const kw = buildKeywords({
      ...baseProfile,
      targetRole: 'Software Engineer',
      headline: 'Software Engineer',
    })
    const unique = new Set(kw)
    expect(unique.size).toBe(kw.length)
  })

  it('handles slash-separated skills without merging tokens', () => {
    const kw = buildKeywords({ ...baseProfile, skillNames: ['Node.js/Express'] })
    // Slash becomes a space separator: keyword is 'node.js express', not 'node.jsexpress'
    expect(kw).toContain('node.js express')
    expect(kw.some(k => k.includes('node.jsexpress'))).toBe(false)
  })

  it('expands seniority for Sr. abbreviation with dot', () => {
    const kw = buildKeywords({ ...baseProfile, targetRole: 'Sr. Software Engineer' })
    expect(kw.some(k => k.includes('senior') && k.includes('software'))).toBe(true)
  })

  it('synonym expansion does not corrupt engineering → developering', () => {
    const kw = buildKeywords({ ...baseProfile, targetRole: 'Senior Engineering Manager' })
    expect(kw.some(k => k.includes('developering'))).toBe(false)
  })

  it('includes additionalRoles with full seniority + synonym expansion', () => {
    const kw = buildKeywords({
      ...baseProfile,
      targetRole: 'Program Manager',
      additionalRoles: ['Operations', 'MarOps'],
    })
    // targetRole expands
    expect(kw.some(k => k.includes('program') && k.includes('manager'))).toBe(true)
    // additionalRoles included
    expect(kw.some(k => k.includes('operations'))).toBe(true)
    expect(kw.some(k => k.includes('marops'))).toBe(true)
  })

  it('treats additionalRoles as optional (undefined does not throw)', () => {
    const kw = buildKeywords({ ...baseProfile, targetRole: 'Engineer' })
    expect(Array.isArray(kw)).toBe(true)
  })
})

describe('matchesProfile', () => {
  it('matches when all tokens of a keyword appear in title', () => {
    const kw = ['engineering manager']
    expect(matchesProfile('Senior Engineering Manager, Platform', kw)).toBe(true)
  })

  it('is case-insensitive', () => {
    const kw = ['engineering manager']
    expect(matchesProfile('ENGINEERING MANAGER', kw)).toBe(true)
  })

  it('does not match when only one token matches', () => {
    // 'senior' alone shouldn't match 'Senior Product Manager' when keyword is 'senior engineer'
    const kw = ['senior engineer']
    expect(matchesProfile('Senior Product Manager', kw)).toBe(false)
  })

  it('matches a tech keyword against a title', () => {
    const kw = ['typescript']
    expect(matchesProfile('TypeScript Engineer', kw)).toBe(true)
  })

  it('does not match internship when targeting senior roles', () => {
    const kw = buildKeywords({ ...baseProfile, targetRole: 'Senior Software Engineer' })
    expect(matchesProfile('Internship — Frontend Development', kw)).toBe(false)
  })

  it('matches staff engineer after seniority expansion from senior', () => {
    const kw = buildKeywords({ ...baseProfile, targetRole: 'Senior Software Engineer' })
    expect(matchesProfile('Staff Software Engineer', kw)).toBe(true)
  })

  it('matches synonym: developer for engineer target', () => {
    const kw = buildKeywords({ ...baseProfile, targetRole: 'Senior Software Engineer' })
    expect(matchesProfile('Senior Software Developer', kw)).toBe(true)
  })

  it('returns false for empty keywords', () => {
    expect(matchesProfile('Any Job Title', [])).toBe(false)
  })
})

describe('matchesLocation', () => {
  it('returns true when no locations configured (filter inactive)', () => {
    expect(matchesLocation('New York, US', [], true)).toBe(true)
    expect(matchesLocation('New York, US', [], false)).toBe(true)
  })

  it('returns true for null/empty location (benefit of doubt)', () => {
    expect(matchesLocation(null, ['UK'], true)).toBe(true)
    expect(matchesLocation('', ['UK'], true)).toBe(true)
    expect(matchesLocation('  ', ['UK'], true)).toBe(true)
  })

  it('includes remote when includeRemote is true', () => {
    expect(matchesLocation('Remote', ['UK'], true)).toBe(true)
    expect(matchesLocation('US-Remote', ['UK'], true)).toBe(true)
    expect(matchesLocation('Remote - US', ['UK'], true)).toBe(true)
    expect(matchesLocation('Fully Remote', ['UK'], true)).toBe(true)
  })

  it('excludes remote when includeRemote is false', () => {
    expect(matchesLocation('Remote', ['UK'], false)).toBe(false)
    expect(matchesLocation('US-Remote', ['UK'], false)).toBe(false)
  })

  it('matches configured locations case-insensitively', () => {
    expect(matchesLocation('London, UK', ['UK', 'Ireland'], true)).toBe(true)
    expect(matchesLocation('Dublin, Ireland', ['UK', 'Ireland'], true)).toBe(true)
    expect(matchesLocation('london, uk', ['UK'], true)).toBe(true)
  })

  it('matches partial location strings', () => {
    expect(matchesLocation('London, United Kingdom', ['United Kingdom'], true)).toBe(true)
  })

  it('excludes non-matching locations', () => {
    expect(matchesLocation('New York, US', ['UK', 'Ireland'], false)).toBe(false)
    expect(matchesLocation('Berlin, Germany', ['UK', 'Ireland'], false)).toBe(false)
  })
})
