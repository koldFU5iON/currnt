import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    chatMemory: { findMany: vi.fn() },
  },
}))

vi.mock('@/modules/llm/client', () => ({
  complete: vi.fn().mockResolvedValue({ text: '• Discussed gap year' }),
}))

import { loadMemorySummaries, applyDecay } from './memory'
import { prisma } from '@/lib/db'

const now = new Date('2026-06-09T12:00:00Z').getTime()

beforeEach(() => {
  vi.clearAllMocks()
  vi.setSystemTime(now)
})

function daysAgo(days: number): Date {
  return new Date(now - days * 24 * 60 * 60 * 1000)
}

describe('applyDecay', () => {
  it('returns full summary for full weight', () => {
    const s = 'First sentence. Second sentence. Third sentence.'
    expect(applyDecay(s, 'full')).toBe(s)
  })

  it('trims to two sentences for trimmed weight', () => {
    const s = 'First sentence. Second sentence. Third sentence.'
    expect(applyDecay(s, 'trimmed')).toBe('First sentence. Second sentence.')
  })

  it('returns first sentence only for first-sentence weight', () => {
    const s = 'First sentence. Second sentence.'
    expect(applyDecay(s, 'first-sentence')).toBe('First sentence.')
  })
})

describe('loadMemorySummaries', () => {
  it('returns full summary for recent entries (< 7 days)', async () => {
    const mockFindMany = vi.mocked(prisma.chatMemory.findMany)
    mockFindMany.mockResolvedValue([
      { id: 'mem-1', profileId: 'profile-1', summary: 'Recent memory. With two sentences.', createdAt: daysAgo(3) },
    ])
    const results = await loadMemorySummaries('profile-1')
    expect(results).toHaveLength(1)
    expect(results[0]).toBe('Recent memory. With two sentences.')
  })

  it('trims summary for entries 7-30 days old', async () => {
    const mockFindMany = vi.mocked(prisma.chatMemory.findMany)
    mockFindMany.mockResolvedValue([
      { id: 'mem-2', profileId: 'profile-1', summary: 'Older memory sentence one. Older memory sentence two. This should be cut.', createdAt: daysAgo(14) },
    ])
    const results = await loadMemorySummaries('profile-1')
    expect(results[0]).toBe('Older memory sentence one. Older memory sentence two.')
  })

  it('returns first sentence only for entries 30-60 days old', async () => {
    const mockFindMany = vi.mocked(prisma.chatMemory.findMany)
    mockFindMany.mockResolvedValue([
      { id: 'mem-3', profileId: 'profile-1', summary: 'Old memory first. Old memory second.', createdAt: daysAgo(45) },
    ])
    const results = await loadMemorySummaries('profile-1')
    expect(results[0]).toBe('Old memory first.')
  })

  it('excludes entries older than 60 days', async () => {
    const mockFindMany = vi.mocked(prisma.chatMemory.findMany)
    mockFindMany.mockResolvedValue([
      { id: 'mem-4', profileId: 'profile-1', summary: 'Very old memory.', createdAt: daysAgo(90) },
    ])
    const results = await loadMemorySummaries('profile-1')
    expect(results).toHaveLength(0)
  })
})
