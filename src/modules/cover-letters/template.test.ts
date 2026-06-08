import { describe, it, expect } from 'vitest'
import { buildCoverLetterTemplate } from './template'

describe('buildCoverLetterTemplate', () => {
  it('includes name as H1', () => {
    const result = buildCoverLetterTemplate({ name: 'Jane Smith' })
    expect(result).toContain('# Jane Smith')
  })

  it('includes headline when provided', () => {
    const result = buildCoverLetterTemplate({ name: 'Jane Smith', headline: 'Senior Engineer' })
    expect(result).toContain('**Senior Engineer**')
  })

  it('omits headline when not provided', () => {
    const result = buildCoverLetterTemplate({ name: 'Jane Smith' })
    expect(result).not.toContain('**')
  })

  it('includes contact details separated by ·', () => {
    const result = buildCoverLetterTemplate({
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+44 7700 900000',
    })
    expect(result).toContain('jane@example.com · +44 7700 900000')
  })

  it('omits contact row when all contact fields are null', () => {
    const result = buildCoverLetterTemplate({
      name: 'Jane Smith',
      email: null,
      phone: null,
      linkedIn: null,
      website: null,
    })
    const lines = result.split('\n')
    expect(lines.some(l => l.includes('·'))).toBe(false)
  })

  it('includes divider and letter opener', () => {
    const result = buildCoverLetterTemplate({ name: 'Jane Smith' })
    expect(result).toContain('---')
    expect(result).toContain('Dear Hiring Manager,')
  })
})
