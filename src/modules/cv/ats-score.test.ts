import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  tokenize,
  extractJDKeywords,
  extractJDTitle,
  extractJDYearsRequired,
  extractJDSeniorityLevel,
  inferExpectedSections,
} from './ats-score'

describe('normalizeText', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeText('Hello, World!')).toBe('hello world')
  })
  it('collapses whitespace', () => {
    expect(normalizeText('  foo   bar  ')).toBe('foo bar')
  })
})

describe('tokenize', () => {
  it('splits on whitespace after normalizing', () => {
    expect(tokenize('React TypeScript')).toEqual(['react', 'typescript'])
  })
  it('filters stop words', () => {
    const tokens = tokenize('the ability to work with teams')
    expect(tokens).not.toContain('the')
    expect(tokens).not.toContain('to')
    expect(tokens).not.toContain('with')
    expect(tokens).toContain('ability')
    expect(tokens).toContain('work')
    expect(tokens).toContain('teams')
  })
  it('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([])
  })
})

describe('extractJDKeywords', () => {
  it('extracts required keywords from Requirements section', () => {
    const jd = `## Requirements\n- 5 years of experience with TypeScript\n- Proficiency in React`
    const { required } = extractJDKeywords(jd)
    expect(required).toContain('typescript')
    expect(required).toContain('react')
  })

  it('extracts preferred keywords from Nice to Have section', () => {
    const jd = `## Nice to Have\n- Knowledge of Docker\n- Experience with Kubernetes`
    const { preferred } = extractJDKeywords(jd)
    expect(preferred).toContain('docker')
    expect(preferred).toContain('kubernetes')
  })

  it('does not duplicate keywords across required and preferred', () => {
    const jd = `## Requirements\n- TypeScript\n## Nice to Have\n- TypeScript`
    const { required, preferred } = extractJDKeywords(jd)
    // TypeScript appears in required first, should not appear in preferred
    expect(required).toContain('typescript')
    expect(preferred).not.toContain('typescript')
  })

  it('filters stop words from keywords', () => {
    const jd = `## Requirements\n- ability to work with teams and the system`
    const { required } = extractJDKeywords(jd)
    expect(required).not.toContain('the')
    expect(required).not.toContain('and')
    expect(required).not.toContain('to')
    expect(required).not.toContain('with')
  })
})

describe('extractJDTitle', () => {
  it('extracts title from common heading patterns', () => {
    expect(extractJDTitle('# Senior Software Engineer\n\nWe are looking...')).toBe('Senior Software Engineer')
  })
  it('extracts title from "Role:" pattern', () => {
    expect(extractJDTitle('Role: Platform Engineer\n\nDescription...')).toBe('Platform Engineer')
  })
  it('returns null when no title found', () => {
    expect(extractJDTitle('We are looking for someone...')).toBeNull()
  })
})

describe('extractJDYearsRequired', () => {
  it('extracts explicit year requirements', () => {
    expect(extractJDYearsRequired('5+ years of experience in software engineering')).toBe(5)
    expect(extractJDYearsRequired('minimum 3 years experience')).toBe(3)
  })
  it('returns null when no year requirement found', () => {
    expect(extractJDYearsRequired('experience required')).toBeNull()
  })
  it('returns the maximum when multiple are mentioned', () => {
    expect(extractJDYearsRequired('3+ years backend, 5+ years total experience')).toBe(5)
  })
})

describe('extractJDSeniorityLevel', () => {
  it('maps title keywords to numeric levels', () => {
    expect(extractJDSeniorityLevel('Senior Software Engineer')).toBe(4)
    expect(extractJDSeniorityLevel('Junior Developer')).toBe(1)
    expect(extractJDSeniorityLevel('Staff Engineer')).toBe(5)
  })
  it('returns null for unknown seniority', () => {
    expect(extractJDSeniorityLevel('Software Engineer')).toBeNull()
  })
})

describe('inferExpectedSections', () => {
  it('always includes skills section', () => {
    const sections = inferExpectedSections('Any job description')
    expect(sections).toContain('skills')
  })
  it('includes tools section when tools are mentioned', () => {
    const jd = 'Experience with Docker, Kubernetes, and CI/CD tools required'
    expect(inferExpectedSections(jd)).toContain('tools')
  })
  it('includes education section when degree is required', () => {
    const jd = "Bachelor's degree in Computer Science required"
    expect(inferExpectedSections(jd)).toContain('education')
  })
  it('includes certifications section when certs are mentioned', () => {
    const jd = 'AWS certification preferred'
    expect(inferExpectedSections(jd)).toContain('certifications')
  })
})
