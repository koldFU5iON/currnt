import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({
  requireProfile: vi.fn().mockResolvedValue({
    profile: { id: 'profile-1', name: 'Test User' },
  }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    coverLetterDocument: { findFirst: vi.fn() },
    cVDocument: { findFirst: vi.fn() },
    jobApplication: { findFirst: vi.fn() },
  },
}))
vi.mock('@/modules/profile/snapshot', () => ({
  buildProfileSnapshot: vi.fn().mockResolvedValue({}),
  serializeProfileForLLM: vi.fn().mockReturnValue('# Test User'),
}))
vi.mock('@/modules/llm/prompt-context', () => ({
  loadWritingContext: vi.fn().mockResolvedValue({ rules: '', brief: null }),
  composeSystem: vi.fn().mockReturnValue('system prompt'),
}))
vi.mock('@/modules/llm/client', () => ({
  complete: vi.fn(),
  completeStructured: vi.fn(),
}))
vi.mock('@/modules/cv/export', () => ({
  toMarkdown: vi.fn().mockReturnValue('CV markdown'),
}))
vi.mock('@/modules/cv/schema', () => ({
  CVDocumentContentSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) },
}))

import { generateDraft, buildWithMe, reviewLetter, analyseRole, buildLetterArchitecture } from './actions'
import type { Stage1Brief } from './schema'
import { prisma } from '@/lib/db'
import { complete, completeStructured } from '@/modules/llm/client'

const mockLetterFind = vi.mocked(prisma.coverLetterDocument.findFirst)
const mockCVFind = vi.mocked(prisma.cVDocument.findFirst)
const mockComplete = vi.mocked(complete)
const mockCompleteStructured = vi.mocked(completeStructured)

describe('generateDraft', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns not_found when letter does not belong to profile', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await generateDraft('letter-missing')
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('calls complete and returns generated content', async () => {
    mockLetterFind.mockResolvedValue({
      id: 'letter-1',
      content: '',
      jobApplicationId: null,
      jobTitle: 'Senior PM',
      company: 'Acme',
      jobApplication: null,
    } as never)
    mockCVFind.mockResolvedValue(null)
    mockComplete.mockResolvedValue({ text: '# Test User\n\nDear Hiring Manager,\n\nBody.' } as never)

    const result = await generateDraft('letter-1')
    expect(result).toEqual({ ok: true, content: '# Test User\n\nDear Hiring Manager,\n\nBody.' })
    expect(mockComplete).toHaveBeenCalledWith(
      'profile-1',
      expect.any(String),
      expect.objectContaining({ feature: 'cover-letter-generate' }),
    )
  })

  it('returns llm error kind on LLMError', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    const { LLMError } = await import('@/modules/llm/errors')
    mockComplete.mockRejectedValue(new LLMError('No key', 'not_configured'))

    const result = await generateDraft('letter-1')
    expect(result).toEqual({ ok: false, error: 'not_configured', message: 'No key' })
  })
})

describe('buildWithMe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns not_found when letter missing', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await buildWithMe('missing', {})
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('includes answers in prompt and calls complete', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    mockComplete.mockResolvedValue({ text: 'Dear Hiring Manager,' } as never)

    const result = await buildWithMe('letter-1', { whyRole: 'Excited about the product', whyCompany: 'Love the mission' })
    expect(result).toEqual({ ok: true, content: 'Dear Hiring Manager,' })

    const promptArg = mockComplete.mock.calls[0][1] as string
    expect(promptArg).toContain('Excited about the product')
    expect(promptArg).toContain('Love the mission')
    expect(mockComplete).toHaveBeenCalledWith(
      'profile-1',
      expect.any(String),
      expect.objectContaining({ feature: 'cover-letter-build' }),
    )
  })
})

describe('reviewLetter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns not_found when letter missing', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await reviewLetter('missing')
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('returns no_content when letter is empty', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    const result = await reviewLetter('letter-1')
    expect(result).toEqual({ ok: false, error: 'no_content', message: expect.any(String) })
  })

  it('calls completeStructured and returns review', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: 'Dear Hiring Manager,\n\nBody text.', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    const review = { issues: [], strengths: ['Clear opening.'], summary: 'Good letter.' }
    mockCompleteStructured.mockResolvedValue({ object: review } as never)

    const result = await reviewLetter('letter-1')
    expect(result).toEqual({ ok: true, review })
    expect(mockCompleteStructured).toHaveBeenCalledWith(
      'profile-1',
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ feature: 'cover-letter-review' }),
    )
  })
})

describe('analyseRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns not_found when letter missing', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await analyseRole('missing')
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('calls completeStructured and returns brief', async () => {
    mockLetterFind.mockResolvedValue({
      id: 'letter-1', content: '', jobApplicationId: null, jobTitle: 'PM', company: 'Acme',
      jobApplication: { title: 'PM', company: 'Acme', jobDescription: 'Build product', jobAnalysis: null },
    } as never)
    mockCVFind.mockResolvedValue(null)
    const brief: Stage1Brief = {
      rolePurpose: 'Drive product strategy for enterprise segment',
      topRequirements: ['Product sense', 'Cross-functional leadership', 'Data fluency'],
      track: 'pm',
      selectedProofPoint: 'Led launch of X to 50k users in 3 months',
      gaps: [],
      screenerCriteria: ['Jira'],
      closeFormula: 'Based in London, eligible to work in UK',
    }
    mockCompleteStructured.mockResolvedValue({ object: brief } as never)

    const result = await analyseRole('letter-1')
    expect(result).toEqual({ ok: true, brief })
    expect(mockCompleteStructured).toHaveBeenCalledWith(
      'profile-1',
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ feature: 'cover-letter-analyse', temperature: 0 }),
    )
  })

  it('returns llm error kind on LLMError', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    const { LLMError } = await import('@/modules/llm/errors')
    mockCompleteStructured.mockRejectedValue(new LLMError('No key', 'not_configured'))
    const result = await analyseRole('letter-1')
    expect(result).toEqual({ ok: false, error: 'not_configured', message: 'No key' })
  })
})

describe('buildLetterArchitecture', () => {
  beforeEach(() => vi.clearAllMocks())

  const brief: Stage1Brief = {
    rolePurpose: 'Drive product strategy for enterprise segment',
    topRequirements: ['Product sense', 'Cross-functional leadership', 'Data fluency'],
    track: 'pm',
    selectedProofPoint: 'Led launch of X to 50k users',
    gaps: [],
    screenerCriteria: [],
    closeFormula: 'Based in London',
  }

  it('returns not_found when letter missing', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await buildLetterArchitecture('missing', brief)
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('calls completeStructured with brief JSON in prompt and returns architecture', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    const architecture = {
      hook: 'Acme needs someone to turn ambiguous product bets into shipped outcomes.',
      connection: "That's the work I've done for four years at Unity.",
      proofSetup: 'Led launch of X — 50k users in 3 months.',
      gapAcknowledgement: null,
      closeFormula: 'Based in London, eligible to work in UK.',
    }
    mockCompleteStructured.mockResolvedValue({ object: architecture } as never)

    const result = await buildLetterArchitecture('letter-1', brief)
    expect(result).toEqual({ ok: true, architecture })
    expect(mockCompleteStructured).toHaveBeenCalledWith(
      'profile-1',
      expect.stringContaining('Drive product strategy'),
      expect.anything(),
      expect.objectContaining({ feature: 'cover-letter-architect' }),
    )
  })
})
