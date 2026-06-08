import { describe, it, expect } from 'vitest'
import { coverLetterSchema, coverLetterListItemSchema } from './schema'

describe('coverLetterSchema', () => {
  const base = {
    id: 'cl-1',
    profileId: 'profile-1',
    jobApplicationId: null,
    content: 'Dear Hiring Manager,',
    status: 'draft',
    jobTitle: null,
    company: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('accepts a valid cover letter', () => {
    expect(coverLetterSchema.safeParse(base).success).toBe(true)
  })

  it('defaults content to empty string when omitted', () => {
    const { content: _, ...without } = base
    const result = coverLetterSchema.safeParse(without)
    expect(result.success).toBe(true)
    expect(result.data?.content).toBe('')
  })

  it('defaults status to draft when omitted', () => {
    const { status: _, ...without } = base
    const result = coverLetterSchema.safeParse(without)
    expect(result.success).toBe(true)
    expect(result.data?.status).toBe('draft')
  })
})

describe('coverLetterListItemSchema', () => {
  it('accepts a valid list item', () => {
    const result = coverLetterListItemSchema.safeParse({
      id: 'cl-1',
      jobTitle: 'Senior PM',
      company: 'Acme',
      jobApplicationId: 'job-1',
      content: 'Dear Hiring Manager, I am writing…',
      status: 'draft',
      updatedAt: new Date(),
      createdAt: new Date(),
    })
    expect(result.success).toBe(true)
  })
})
