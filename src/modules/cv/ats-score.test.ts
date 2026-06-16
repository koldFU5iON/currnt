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
  scoreKeywordCoverage,
  scoreTitleAlignment,
  scoreSectionCompleteness,
  scoreSenioritySignal,
  scoreATS,
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

  it('falls back to bullet extraction when no section headers found', () => {
    const jd = [
      'About Acme Corp — we build reliable software for the world.',
      '- TypeScript is our primary language',
      '- Experience with React required',
      '- Kubernetes preferred',
    ].join('\n')
    const { required, preferred } = extractJDKeywords(jd)
    // Bullet content is extracted
    expect(required).toContain('typescript')
    expect(required).toContain('react')
    // Prose content is NOT extracted (not a bullet line)
    expect(required).not.toContain('acme')
    expect(required).not.toContain('reliable')
    // "preferred" signal on bullet → goes to preferred, not required
    expect(preferred).toContain('kubernetes')
    expect(required).not.toContain('kubernetes')
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

describe('scoreKeywordCoverage', () => {
  const cvContent: CVDocumentContent = {
    version: 1,
    sections: [
      { id: 's1', type: 'skills', visible: true, data: { items: ['TypeScript', 'React'] } },
      { id: 's2', type: 'tools', visible: true, data: { items: ['Docker'] } },
      {
        id: 's3', type: 'experience', visible: true,
        data: {
          company: 'Acme', titles: ['Senior Software Engineer'],
          location: 'London', duration: 'Jan 2020 – Dec 2023',
          description: 'Built microservices with Node.js.',
          outcomes: ['Led team of 5 engineers'],
        },
      },
    ],
  }

  it('matches required keywords in skills section', () => {
    const result = scoreKeywordCoverage(cvContent, ['typescript', 'react'], [], [])
    expect(result.matchedRequired.some(m => m.keyword === 'typescript')).toBe(true)
    expect(result.score).toBeGreaterThan(50)
  })

  it('reports missing required keywords', () => {
    const result = scoreKeywordCoverage(cvContent, ['typescript', 'kubernetes'], [], [])
    expect(result.missingRequired).toContain('kubernetes')
  })

  it('matches implied keywords', () => {
    const result = scoreKeywordCoverage(cvContent, [], [], ['docker'])
    expect(result.matchedImplied.some(m => m.keyword === 'docker')).toBe(true)
  })

  it('returns 100 when CV matches all required keywords', () => {
    const result = scoreKeywordCoverage(cvContent, ['typescript'], [], [])
    expect(result.score).toBe(100)
  })

  it('returns 0 when no keywords match', () => {
    const result = scoreKeywordCoverage(cvContent, ['cobol', 'fortran'], [], [])
    expect(result.score).toBe(0)
  })
})

describe('scoreTitleAlignment', () => {
  const cvWithTitle: CVDocumentContent = {
    version: 1,
    sections: [
      {
        id: 's1', type: 'experience', visible: true,
        data: {
          company: 'Acme', titles: ['Senior Software Engineer'],
          location: 'London', duration: 'Jan 2020 – Present',
          description: '', outcomes: [],
        },
      },
    ],
  }

  it('scores 100 for identical titles', () => {
    const result = scoreTitleAlignment(cvWithTitle, 'Senior Software Engineer')
    expect(result.score).toBe(100)
  })

  it('scores high for closely related titles', () => {
    const result = scoreTitleAlignment(cvWithTitle, 'Senior Backend Engineer')
    expect(result.score).toBeGreaterThanOrEqual(50)
  })

  it('scores 50 when jdTitle is null', () => {
    const result = scoreTitleAlignment(cvWithTitle, null)
    expect(result.score).toBe(50)
  })

  it('populates jdTitle and cvTitle', () => {
    const result = scoreTitleAlignment(cvWithTitle, 'Lead Engineer')
    expect(result.jdTitle).toBe('Lead Engineer')
    expect(result.cvTitle).toBe('Senior Software Engineer')
  })

  it('scores 0 for completely unrelated titles', () => {
    const result = scoreTitleAlignment(cvWithTitle, 'Chief Financial Officer')
    expect(result.score).toBe(0)
  })
})

describe('scoreSectionCompleteness', () => {
  it('scores 100 when no sections expected', () => {
    const cv: CVDocumentContent = { version: 1, sections: [] }
    const result = scoreSectionCompleteness(cv, 'We are looking for a great team member.')
    expect(result.score).toBe(100)
  })

  it('expects skills or tools for technical JDs', () => {
    const cv: CVDocumentContent = { version: 1, sections: [] }
    const result = scoreSectionCompleteness(cv, 'We need a senior software engineer with React.')
    expect(result.expectedSections.some(s => s === 'skills' || s === 'tools')).toBe(true)
  })

  it('scores 100 when all expected sections are present and visible', () => {
    const cv: CVDocumentContent = {
      version: 1,
      sections: [
        { id: 's1', type: 'skills', visible: true, data: { items: ['TypeScript'] } },
      ],
    }
    const result = scoreSectionCompleteness(cv, 'Senior software engineer with TypeScript required.')
    const expected = result.expectedSections.filter(s => s === 'skills' || s === 'tools')
    const present = result.presentSections
    expect(expected.every(s => present.includes(s))).toBe(true)
  })

  it('scores lower when expected sections are missing', () => {
    const cv: CVDocumentContent = { version: 1, sections: [] }
    const result = scoreSectionCompleteness(cv, 'Senior software engineer with React required.')
    expect(result.score).toBeLessThan(100)
    expect(result.missingSections.length).toBeGreaterThan(0)
  })
})

describe('scoreSenioritySignal', () => {
  const cvWithExperience: CVDocumentContent = {
    version: 1,
    sections: [
      {
        id: 's1', type: 'experience', visible: true,
        data: {
          company: 'Acme', titles: ['Senior Engineer'],
          location: 'London', duration: 'Jan 2018 – Dec 2022',
          description: '', outcomes: [],
        },
      },
      {
        id: 's2', type: 'experience', visible: true,
        data: {
          company: 'Beta', titles: ['Junior Developer'],
          location: 'London', duration: 'Jan 2016 – Dec 2017',
          description: '', outcomes: [],
        },
      },
    ],
  }

  it('scores 100 when CV years exceed JD requirement', () => {
    const result = scoreSenioritySignal(cvWithExperience, 'Minimum 3 years experience required.')
    expect(result.score).toBe(100)
    expect(result.seniorityBasis).toBe('years')
  })

  it('scores proportionally when CV years are below requirement', () => {
    const result = scoreSenioritySignal(cvWithExperience, 'Minimum 10 years experience required.')
    expect(result.score).toBeLessThan(100)
    expect(result.jdRequiredYears).toBe(10)
  })

  it('uses keyword matching when no year requirement found', () => {
    const result = scoreSenioritySignal(cvWithExperience, 'We need a senior software engineer.')
    expect(result.seniorityBasis).toBe('keywords')
    expect(result.score).toBe(100)
  })

  it('returns neutral score when no year requirement and no seniority keywords', () => {
    const result = scoreSenioritySignal(cvWithExperience, 'We need a great communicator.')
    expect(result.seniorityBasis).toBe('neutral')
    expect(result.score).toBe(60)
  })

  it('reports total CV years', () => {
    const result = scoreSenioritySignal(cvWithExperience, 'Minimum 3 years required.')
    // Jan 2018–Dec 2022 = ~4y + Jan 2016–Dec 2017 = ~2y → ~6y total
    expect(result.cvTotalYears).toBeGreaterThan(4)
  })
})

describe('scoreATS (integration)', () => {
  const wellMatchedCV: CVDocumentContent = {
    version: 1,
    sections: [
      { id: 's1', type: 'skills', visible: true, data: { items: ['TypeScript', 'React', 'Node.js', 'GraphQL'] } },
      { id: 's2', type: 'tools', visible: true, data: { items: ['Docker', 'AWS', 'PostgreSQL'] } },
      {
        id: 's3', type: 'experience', visible: true,
        data: {
          company: 'Acme', titles: ['Senior Software Engineer'],
          location: 'London', duration: 'Jan 2019 – Present',
          description: 'Led backend development using TypeScript and Node.js.',
          outcomes: ['Reduced API latency by 40%', 'Introduced React component library'],
        },
      },
    ],
  }

  const matchingJD = `
    Job Title: Senior Software Engineer

    We are looking for a Senior Software Engineer with 5+ years of experience.

    Requirements (must have):
    - TypeScript required
    - React is required
    - Node.js experience essential

    Nice to have:
    - Docker preferred
    - GraphQL is a bonus
  `

  it('returns a finalScore between 0 and 100', () => {
    const result = scoreATS(wellMatchedCV, matchingJD, [])
    expect(result.finalScore).toBeGreaterThanOrEqual(0)
    expect(result.finalScore).toBeLessThanOrEqual(100)
  })

  it('produces a high score for a well-matched CV', () => {
    const result = scoreATS(wellMatchedCV, matchingJD, [])
    expect(result.finalScore).toBeGreaterThan(70)
  })

  it('assigns the correct label', () => {
    const result = scoreATS(wellMatchedCV, matchingJD, [])
    expect(['poor', 'fair', 'good', 'strong', 'excellent']).toContain(result.label)
  })

  it('weighted contributions sum to finalScore', () => {
    const result = scoreATS(wellMatchedCV, matchingJD, [])
    const sumContributions = Object.values(result.dimensions)
      .reduce((s, d) => s + d.weightedContribution, 0)
    expect(Math.round(sumContributions)).toBe(result.finalScore)
  })

  it('produces a poor score for an unrelated CV', () => {
    const mismatchedCV: CVDocumentContent = {
      version: 1,
      sections: [
        { id: 's1', type: 'skills', visible: true, data: { items: ['Photoshop', 'Illustrator', 'InDesign'] } },
        {
          id: 's2', type: 'experience', visible: true,
          data: {
            company: 'Design Co', titles: ['Graphic Designer'],
            location: 'London', duration: 'Jan 2020 – Present',
            description: 'Brand design and print production.',
            outcomes: [],
          },
        },
      ],
    }
    const result = scoreATS(mismatchedCV, matchingJD, [])
    expect(result.finalScore).toBeLessThan(50)
  })
})
