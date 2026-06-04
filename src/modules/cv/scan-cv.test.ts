import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/modules/llm/client', () => ({
  completeStructured: vi.fn(),
}))
vi.mock('@/modules/llm/prompt-context', () => ({
  loadCVScanPrompt: vi.fn(),
  composeSystem: vi.fn(),
}))

import { serializeCVForScan, scanCV } from './scan-cv'
import { completeStructured } from '@/modules/llm/client'
import { loadCVScanPrompt, composeSystem } from '@/modules/llm/prompt-context'
import type { CVDocumentContent } from './schema'

const mockCompleteStructured = vi.mocked(completeStructured)
const mockLoadPrompt = vi.mocked(loadCVScanPrompt)
const mockComposeSystem = vi.mocked(composeSystem)

const PROFILE_ID = 'profile-1'

const MOCK_CV: CVDocumentContent = {
  version: 1,
  sections: [
    {
      id: 'header',
      type: 'header',
      visible: true,
      data: {
        name: 'Jane Smith',
        headline: 'Communications Director',
        contact: { email: 'jane@example.com' },
      },
    },
    {
      id: 'profile',
      type: 'profile',
      visible: true,
      data: { content: 'Directed EMEA communications across 8 territories.' },
    },
    {
      id: 'exp-1',
      type: 'experience',
      visible: true,
      data: {
        company: 'Unity',
        titles: ['Communications Director'],
        location: 'London',
        duration: '2020 – present',
        description: 'Led EMEA comms team of 12.',
        outcomes: [
          'Directed communications across 8 European territories',
          'Managed €500k annual PR budget',
        ],
      },
    },
    {
      id: 'exp-hidden',
      type: 'experience',
      visible: false,
      data: {
        company: 'Hidden Co',
        titles: ['Manager'],
        location: 'London',
        duration: '2015 – 2020',
        description: 'This should not appear.',
        outcomes: ['This outcome should not appear'],
      },
    },
  ],
}

const MOCK_SCAN = {
  takeaways: ['Directed 8 European territories', 'Managed €500k PR budget'],
  positioningMatch: true,
  gaps: [],
}

describe('serializeCVForScan', () => {
  it('includes the candidate name from the header', () => {
    const text = serializeCVForScan(MOCK_CV)
    expect(text).toContain('Jane Smith')
  })

  it('includes experience outcomes as bullet points', () => {
    const text = serializeCVForScan(MOCK_CV)
    expect(text).toContain('• Directed communications across 8 European territories')
    expect(text).toContain('• Managed €500k annual PR budget')
  })

  it('omits sections where visible is false', () => {
    const text = serializeCVForScan(MOCK_CV)
    expect(text).not.toContain('Hidden Co')
    expect(text).not.toContain('This outcome should not appear')
  })

  it('includes the profile summary', () => {
    const text = serializeCVForScan(MOCK_CV)
    expect(text).toContain('Directed EMEA communications across 8 territories.')
  })
})

describe('scanCV', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadPrompt.mockResolvedValue('Scan prompt')
    mockComposeSystem.mockReturnValue('Composed system')
  })

  it('returns the scan result on success', async () => {
    mockCompleteStructured.mockResolvedValue({ object: MOCK_SCAN } as never)

    const result = await scanCV(PROFILE_ID, MOCK_CV, 'Lead with multi-territory scope.')

    expect(result).toEqual(MOCK_SCAN)
  })

  it('includes the positioning strategy in the user message', async () => {
    mockCompleteStructured.mockResolvedValue({ object: MOCK_SCAN } as never)

    await scanCV(PROFILE_ID, MOCK_CV, 'Lead with multi-territory scope.')

    const [, userMessage] = mockCompleteStructured.mock.calls[0]
    expect(userMessage).toContain('Lead with multi-territory scope.')
  })

  it('returns null and does not throw when the LLM call fails', async () => {
    mockCompleteStructured.mockRejectedValue(new Error('LLM timeout'))

    const result = await scanCV(PROFILE_ID, MOCK_CV)

    expect(result).toBeNull()
  })

  it('calls completeStructured with feature cv-recruiter-scan', async () => {
    mockCompleteStructured.mockResolvedValue({ object: MOCK_SCAN } as never)

    await scanCV(PROFILE_ID, MOCK_CV)

    expect(mockCompleteStructured).toHaveBeenCalledWith(
      PROFILE_ID,
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ feature: 'cv-recruiter-scan' }),
    )
  })

  it('includes must-have requirements in the user message when provided', async () => {
    mockCompleteStructured.mockResolvedValue({ object: MOCK_SCAN } as never)

    await scanCV(PROFILE_ID, MOCK_CV, undefined, ['Multi-territory experience', 'Budget ownership'])

    const [, userMessage] = mockCompleteStructured.mock.calls[0]
    expect(userMessage).toContain('== MUST-HAVE REQUIREMENTS ==')
    expect(userMessage).toContain('- Multi-territory experience')
    expect(userMessage).toContain('- Budget ownership')
  })

  it('omits the must-have block when mustHave is empty', async () => {
    mockCompleteStructured.mockResolvedValue({ object: MOCK_SCAN } as never)

    await scanCV(PROFILE_ID, MOCK_CV, undefined, [])

    const [, userMessage] = mockCompleteStructured.mock.calls[0]
    expect(userMessage).not.toContain('== MUST-HAVE REQUIREMENTS ==')
  })
})
