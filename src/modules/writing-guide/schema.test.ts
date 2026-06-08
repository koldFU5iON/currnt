import { describe, it, expect } from 'vitest'
import { BuildWithMeInputs, ReviewOutputSchema } from './schema'

describe('BuildWithMeInputs', () => {
  it('accepts all fields empty', () => {
    const result = BuildWithMeInputs.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial answers', () => {
    const result = BuildWithMeInputs.safeParse({ whyRole: 'I love this field' })
    expect(result.success).toBe(true)
    expect(result.data?.whyRole).toBe('I love this field')
  })
})

describe('ReviewOutputSchema', () => {
  it('parses a valid review', () => {
    const input = {
      issues: [{ category: 'weak_evidence', severity: 'high', description: 'No metrics.' }],
      strengths: ['Strong opener.'],
      summary: 'Good start, needs evidence.',
    }
    const result = ReviewOutputSchema.safeParse(input)
    expect(result.success).toBe(true)
    expect(result.data?.issues[0].severity).toBe('high')
  })

  it('rejects unknown severity', () => {
    const input = {
      issues: [{ category: 'weak_evidence', severity: 'critical', description: 'x' }],
      strengths: [],
      summary: 'x',
    }
    expect(ReviewOutputSchema.safeParse(input).success).toBe(false)
  })

  it('rejects unknown category', () => {
    const input = {
      issues: [{ category: 'bad_vibes', severity: 'high', description: 'x' }],
      strengths: [],
      summary: 'x',
    }
    expect(ReviewOutputSchema.safeParse(input).success).toBe(false)
  })
})
