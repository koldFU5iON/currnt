import { expect, test } from 'vitest'
import { buildImportSummary } from './summary-builder'

test('returns empty string when no activities', () => {
  const result = buildImportSummary({
    role: 'Engineer',
    company: 'Acme',
    startDate: new Date('2021-01-01'),
    endDate: null,
    activities: [],
  })
  expect(result).toBe('')
})

test('builds responsibilities section', () => {
  const result = buildImportSummary({
    role: 'Engineer',
    company: 'Acme',
    startDate: new Date('2021-01-01'),
    endDate: null,
    activities: [
      { kind: 'responsibility', description: 'Led platform team' },
      { kind: 'responsibility', description: 'Owned CI/CD pipeline' },
    ],
  })
  expect(result).toContain('## Responsibilities')
  expect(result).toContain('- Led platform team')
  expect(result).toContain('- Owned CI/CD pipeline')
})

test('builds achievements section', () => {
  const result = buildImportSummary({
    role: 'Engineer',
    company: 'Acme',
    startDate: new Date('2021-01-01'),
    endDate: null,
    activities: [
      { kind: 'achievement', description: 'Reduced deploy time 70%' },
    ],
  })
  expect(result).toContain('## Achievements')
  expect(result).toContain('- Reduced deploy time 70%')
  expect(result).not.toContain('## Responsibilities')
})

test('includes both sections when both kinds present', () => {
  const result = buildImportSummary({
    role: 'Engineer',
    company: 'Acme',
    startDate: new Date('2021-01-01'),
    endDate: null,
    activities: [
      { kind: 'responsibility', description: 'Led team' },
      { kind: 'achievement', description: 'Shipped feature' },
    ],
  })
  expect(result).toContain('## Responsibilities')
  expect(result).toContain('## Achievements')
})
