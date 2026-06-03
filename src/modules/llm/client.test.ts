import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    userSettings: { findUnique: vi.fn() },
    llmUsageLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/lib/encryption', () => ({ decrypt: vi.fn().mockReturnValue('sk-test') }))

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: 'hello',
    finishReason: 'stop',
    output: { name: 'Test' },
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  }),
  Output: { object: vi.fn().mockReturnValue({}) },
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn().mockReturnValue(() => 'mock-model'),
}))
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockReturnValue(() => 'mock-model'),
}))
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn().mockReturnValue(() => 'mock-model'),
}))

vi.mock('next/server', () => ({ after: vi.fn(cb => cb()) }))

import { complete, completeStructured } from './client'
import { prisma } from '@/lib/db'
import * as z from 'zod'

const mockFindUnique = vi.mocked(prisma.userSettings.findUnique)
const mockLogCreate = vi.mocked(prisma.llmUsageLog.create)

const fakeSettings = {
  llmProvider: 'anthropic',
  llmModel: 'claude-sonnet-4-6',
  llmApiKey: 'enc-key',
}

describe('LLM client logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUnique.mockResolvedValue(fakeSettings as never)
    mockLogCreate.mockResolvedValue({} as never)
  })

  it('calls llmUsageLog.create after a successful complete()', async () => {
    await complete('profile-1', 'hello', { feature: 'test' })
    await vi.waitFor(() => expect(mockLogCreate).toHaveBeenCalled())
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileId: 'profile-1',
          provider: 'anthropic',
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          feature: 'test',
        }),
      }),
    )
  })

  it('passes feature label through to the log', async () => {
    await complete('profile-1', 'hello', { feature: 'job-fit' })
    await vi.waitFor(() => expect(mockLogCreate).toHaveBeenCalled())
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ feature: 'job-fit' }),
      }),
    )
  })

  it('calls llmUsageLog.create after completeStructured()', async () => {
    const schema = z.object({ name: z.string() })
    await completeStructured('profile-1', 'hello', schema, { feature: 'cv-import' })
    await vi.waitFor(() => expect(mockLogCreate).toHaveBeenCalled())
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ feature: 'cv-import', totalTokens: 30 }),
      }),
    )
  })

  it('does not throw if log write fails', async () => {
    mockLogCreate.mockRejectedValueOnce(new Error('DB down'))
    await expect(complete('profile-1', 'hello', { feature: 'test' })).resolves.not.toThrow()
  })
})
