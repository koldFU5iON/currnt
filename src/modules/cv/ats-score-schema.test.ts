import { describe, it, expect } from 'vitest'
import { serializeATSScoreForContext } from './ats-score-schema'
import type { ATSScoreResult } from './ats-score-schema'

const MOCK_RESULT: ATSScoreResult = {
  breakdown: {
    finalScore: 68,
    label: 'good',
    dimensions: {
      keywordCoverage: {
        score: 72, weight: 0.45, weightedContribution: 32.4,
        matchedRequired: [{ keyword: 'typescript', section: 'skills', sectionWeight: 1.0 }],
        matchedPreferred: [],
        matchedImplied: [{ keyword: 'javascript', section: 'skills' }],
        missingRequired: ['docker', 'kubernetes'],
        missingPreferred: ['helm'],
        missingImplied: [],
      },
      titleAlignment: {
        score: 65, weight: 0.20, weightedContribution: 13,
        jdTitle: 'Senior Platform Engineer',
        cvTitle: 'Senior Software Engineer',
        matchedTokens: ['senior', 'engineer'],
      },
      sectionCompleteness: {
        score: 85, weight: 0.20, weightedContribution: 17,
        expectedSections: ['skills', 'tools'],
        presentSections: ['skills'],
        missingSections: ['tools'],
      },
      senioritySignal: {
        score: 80, weight: 0.15, weightedContribution: 12,
        jdRequiredYears: 5,
        cvTotalYears: 6.2,
        seniorityBasis: 'years',
      },
    },
  },
  interpretation: {
    summary: 'Your CV scores 68/100.',
    dimensionNotes: [],
    profileOpportunities: [
      { asset: 'Docker (skill, expert)', targetSection: 'tools', rationale: 'JD requires Docker' },
    ],
  },
  impliedKeywords: ['javascript'],
}

describe('serializeATSScoreForContext', () => {
  it('includes final score and label', () => {
    const output = serializeATSScoreForContext(MOCK_RESULT)
    expect(output).toContain('68/100')
    expect(output).toContain('good')
  })

  it('lists missing required keywords', () => {
    const output = serializeATSScoreForContext(MOCK_RESULT)
    expect(output).toContain('docker')
    expect(output).toContain('kubernetes')
  })

  it('shows title comparison', () => {
    const output = serializeATSScoreForContext(MOCK_RESULT)
    expect(output).toContain('Senior Platform Engineer')
    expect(output).toContain('Senior Software Engineer')
  })

  it('lists profile opportunities', () => {
    const output = serializeATSScoreForContext(MOCK_RESULT)
    expect(output).toContain('Docker (skill, expert)')
  })

  it('handles null interpretation gracefully', () => {
    const result = { ...MOCK_RESULT, interpretation: null }
    expect(() => serializeATSScoreForContext(result)).not.toThrow()
  })
})
