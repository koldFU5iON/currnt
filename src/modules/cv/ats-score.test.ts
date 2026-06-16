import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  tokenize,
  extractJDKeywords,
  extractJDTitle,
  extractJDYearsRequired,
  extractJDSeniorityLevel,
  inferExpectedSections,
  extractCVSectionTokens,
  parseDurationToYears,
} from './ats-score'
import type { CVDocumentContent } from './schema'

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

const MOCK_CV: CVDocumentContent = {
  version: 1,
  sections: [
    {
      id: 's1', type: 'skills', visible: true,
      data: { items: ['TypeScript', 'React', 'Node.js'] },
    },
    {
      id: 's2', type: 'tools', visible: true,
      data: { items: ['Docker', 'AWS'] },
    },
    {
      id: 's3', type: 'experience', visible: true,
      data: {
        company: 'Acme Corp', titles: ['Senior Software Engineer'],
        location: 'London', duration: 'Jan 2020 – Dec 2023',
        description: 'Led backend services migration to microservices.',
        outcomes: ['Reduced latency by 40%', 'Introduced TypeScript across the team'],
      },
    },
    {
      id: 's4', type: 'experience', visible: false,
      data: {
        company: 'Hidden Corp', titles: ['Junior Developer'],
        location: 'London', duration: '2018 – 2019',
        description: 'Hidden content.',
        outcomes: [],
      },
    },
  ],
}

describe('extractCVSectionTokens', () => {
  it('extracts skills with weight 1.0', () => {
    const tokens = extractCVSectionTokens(MOCK_CV)
    const skillToken = tokens.find(t => t.text === 'typescript' && t.sectionType === 'skills')
    expect(skillToken).toBeDefined()
    expect(skillToken?.weight).toBe(1.0)
  })

  it('extracts tools with weight 1.0', () => {
    const tokens = extractCVSectionTokens(MOCK_CV)
    const toolToken = tokens.find(t => t.text === 'docker' && t.sectionType === 'tools')
    expect(toolToken).toBeDefined()
    expect(toolToken?.weight).toBe(1.0)
  })

  it('extracts experience titles with weight 0.9', () => {
    const tokens = extractCVSectionTokens(MOCK_CV)
    const titleTokens = tokens.filter(t => t.sectionType === 'exp-title')
    expect(titleTokens.some(t => t.text.includes('senior software engineer'))).toBe(true)
    expect(titleTokens[0]?.weight).toBe(0.9)
  })

  it('excludes non-visible sections', () => {
    const tokens = extractCVSectionTokens(MOCK_CV)
    expect(tokens.some(t => t.text.includes('hidden'))).toBe(false)
  })
})

describe('parseDurationToYears', () => {
  it('parses month-year range', () => {
    const years = parseDurationToYears('Jan 2020 – Dec 2023')
    expect(years).toBeCloseTo(3.9, 0)
  })

  it('handles "present" as end date', () => {
    const years = parseDurationToYears('Jan 2020 – Present')
    expect(years).toBeGreaterThan(0)
  })

  it('parses year-only range using midpoint', () => {
    const years = parseDurationToYears('2018 – 2022')
    expect(years).toBeCloseTo(4, 0)
  })

  it('returns 0 for unparseable strings', () => {
    expect(parseDurationToYears('unknown')).toBe(0)
  })
})
