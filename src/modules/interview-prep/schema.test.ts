import { describe, it, expect } from 'vitest'
import {
  TextBlockSchema,
  AiAnalysisBlockSchema,
  QaBankBlockSchema,
  SectionsSchema,
  PrepSessionSchema,
  normalizeSections,
} from './schema'

describe('TextBlockSchema', () => {
  it('accepts a valid text block', () => {
    const result = TextBlockSchema.safeParse({
      id: 'blk_1', type: 'text', title: 'Key Themes', content: '- point', order: 0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing type', () => {
    const result = TextBlockSchema.safeParse({ id: 'b1', title: 'x', content: '', order: 0 })
    expect(result.success).toBe(false)
  })
})

describe('AiAnalysisBlockSchema', () => {
  it('accepts a block with no source ids', () => {
    const result = AiAnalysisBlockSchema.safeParse({
      id: 'blk_2', type: 'ai-analysis', title: 'Insights', content: 'text', order: 1,
    })
    expect(result.success).toBe(true)
    expect(result.data?.sourceDocIds).toEqual([])
    expect(result.data?.sourceInterviewerIds).toEqual([])
  })

  it('accepts sourceDocIds and sourceInterviewerIds', () => {
    const result = AiAnalysisBlockSchema.safeParse({
      id: 'blk_2', type: 'ai-analysis', title: 'Insights', content: 'text', order: 1,
      sourceDocIds: ['doc_1'], sourceInterviewerIds: ['int_1'],
    })
    expect(result.success).toBe(true)
  })
})

describe('QaBankBlockSchema', () => {
  it('accepts a valid qa-bank block', () => {
    const result = QaBankBlockSchema.safeParse({
      id: 'blk_3', type: 'qa-bank', title: 'Q&A Bank', content: '## Screening\n- Tell me about yourself', order: 2,
    })
    expect(result.success).toBe(true)
  })
})

describe('SectionsSchema', () => {
  it('accepts an empty array', () => {
    expect(SectionsSchema.safeParse([]).success).toBe(true)
  })

  it('accepts a mixed array of block types', () => {
    const result = SectionsSchema.safeParse([
      { id: 'b1', type: 'text', title: 'A', content: '', order: 0 },
      { id: 'b2', type: 'ai-analysis', title: 'B', content: '', order: 1 },
      { id: 'b3', type: 'qa-bank', title: 'C', content: '', order: 2 },
    ])
    expect(result.success).toBe(true)
  })

  it('rejects an unknown block type', () => {
    const result = SectionsSchema.safeParse([
      { id: 'b1', type: 'unknown', title: 'X', content: '', order: 0 },
    ])
    expect(result.success).toBe(false)
  })
})

describe('normalizeSections', () => {
  it('returns empty array for null/undefined', () => {
    expect(normalizeSections(null)).toEqual([])
    expect(normalizeSections(undefined)).toEqual([])
  })

  it('parses a valid sections value from DB', () => {
    const raw = [{ id: 'b1', type: 'text', title: 'A', content: '', order: 0 }]
    expect(normalizeSections(raw)).toHaveLength(1)
  })

  it('returns empty array for invalid shape (graceful fallback)', () => {
    expect(normalizeSections('not an array')).toEqual([])
  })
})

describe('PrepSessionSchema', () => {
  it('accepts a valid session', () => {
    const result = PrepSessionSchema.safeParse({
      id: 's1', profileId: 'p1', title: 'PM @ Acme', company: 'Acme',
      jobTitle: 'PM', jobApplicationId: null, status: 'draft',
      createdAt: new Date(), updatedAt: new Date(),
    })
    expect(result.success).toBe(true)
  })

  it('defaults status to draft', () => {
    const result = PrepSessionSchema.safeParse({
      id: 's1', profileId: 'p1', title: 'PM @ Acme',
      createdAt: new Date(), updatedAt: new Date(),
    })
    expect(result.success).toBe(true)
    expect(result.data?.status).toBe('draft')
  })
})
