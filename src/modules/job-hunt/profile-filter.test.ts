import { describe, it, expect } from 'vitest'
import { buildKeywords, matchesProfile } from './profile-filter'

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
