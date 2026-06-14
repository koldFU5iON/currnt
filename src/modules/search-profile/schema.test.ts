import { describe, it, expect } from 'vitest'
import {
  normalizeSearchProfile,
  searchProfileHasContent,
  normalizeSuggestions,
  emptySearchProfile,
} from './schema'

describe('normalizeSearchProfile', () => {
  it('returns empty defaults for null input', () => {
    expect(normalizeSearchProfile(null)).toEqual(emptySearchProfile)
  })

  it('returns empty defaults for invalid input', () => {
    expect(normalizeSearchProfile('not-an-object')).toEqual(emptySearchProfile)
  })

  it('parses a valid profile', () => {
    const raw = {
      preferredName: 'Devon',
      currentRole: 'Comms Ops',
      roles: ['Director of Operations'],
      countries: ['UK'],
      remotePreference: 'remote',
      salaryBand: { min: 80000, max: 120000, currency: 'GBP' },
      careerGoals: 'Want to lead ops at a mission-driven tech company',
      pivotContext: '',
      extraContext: '',
    }
    const result = normalizeSearchProfile(raw)
    expect(result.preferredName).toBe('Devon')
    expect(result.roles).toEqual(['Director of Operations'])
    expect(result.salaryBand?.min).toBe(80000)
    expect(result.remotePreference).toBe('remote')
  })

  it('defaults salaryBand to null when absent', () => {
    expect(normalizeSearchProfile({}).salaryBand).toBeNull()
  })

  it('defaults roles to empty array when absent', () => {
    expect(normalizeSearchProfile({}).roles).toEqual([])
  })

  it('rejects unknown remotePreference values', () => {
    const result = normalizeSearchProfile({ remotePreference: 'moonbase' })
    expect(result.remotePreference).toBe('')
  })
})

describe('searchProfileHasContent', () => {
  it('returns false for empty profile', () => {
    expect(searchProfileHasContent(emptySearchProfile)).toBe(false)
  })

  it('returns true when preferredName is set', () => {
    expect(searchProfileHasContent({ ...emptySearchProfile, preferredName: 'Devon' })).toBe(true)
  })

  it('returns true when roles is non-empty', () => {
    expect(searchProfileHasContent({ ...emptySearchProfile, roles: ['Head of Ops'] })).toBe(true)
  })

  it('returns true when salaryBand is set', () => {
    expect(
      searchProfileHasContent({ ...emptySearchProfile, salaryBand: { min: 80000, max: null, currency: 'GBP' } }),
    ).toBe(true)
  })
})

describe('normalizeSuggestions', () => {
  it('returns empty array for null', () => {
    expect(normalizeSuggestions(null)).toEqual([])
  })

  it('returns empty array for non-array', () => {
    expect(normalizeSuggestions('bad')).toEqual([])
  })

  it('filters out invalid entries', () => {
    const input = [
      { id: '1', field: 'roles', suggestedValue: ['DevRel'], reason: 'test', source: 'chat', createdAt: '2026-01-01T00:00:00Z' },
      { id: '2', field: 'INVALID_FIELD', suggestedValue: 'x', reason: 'r', source: 'chat', createdAt: '2026-01-01T00:00:00Z' },
    ]
    expect(normalizeSuggestions(input)).toHaveLength(1)
    expect(normalizeSuggestions(input)[0].id).toBe('1')
  })
})
