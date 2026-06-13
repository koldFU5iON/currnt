// src/modules/job-hunt/board-sources/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({
  requireProfile: vi.fn().mockResolvedValue({ profile: { id: 'profile-1' } }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    jobBoardSource: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    discoveredJob: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    userSettings: {
      findUnique: vi.fn().mockResolvedValue({ jobHuntSearch: null, jobBoardApiKeys: null }),
      upsert: vi.fn(),
    },
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn((v: string) => v),
  encrypt: vi.fn((v: string) => v),
}))

import { toggleBoardSource, saveJobHuntSearch } from './actions'
import { prisma } from '@/lib/db'

const mockFindFirst = vi.mocked(prisma.jobBoardSource.findFirst)
const mockUpdate = vi.mocked(prisma.jobBoardSource.update)
const mockSettingsUpsert = vi.mocked(prisma.userSettings.upsert)

describe('toggleBoardSource', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flips enabled to false when currently true', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'src-1', enabled: true } as never)
    mockUpdate.mockResolvedValueOnce({} as never)

    await toggleBoardSource('src-1')

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'src-1' },
      data: { enabled: false },
    })
  })

  it('flips enabled to true when currently false', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'src-1', enabled: false } as never)
    mockUpdate.mockResolvedValueOnce({} as never)

    await toggleBoardSource('src-1')

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'src-1' },
      data: { enabled: true },
    })
  })

  it('returns not_found when source does not belong to profile', async () => {
    mockFindFirst.mockResolvedValueOnce(null)
    const result = await toggleBoardSource('src-999')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })
})

describe('saveJobHuntSearch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts jobHuntSearch into UserSettings', async () => {
    mockSettingsUpsert.mockResolvedValueOnce({} as never)
    await saveJobHuntSearch({
      roles: ['EM'],
      locations: ['Ireland'],
      datePosted: 'last30',
      minSalary: 90000,
    })
    expect(mockSettingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: 'profile-1' },
        update: expect.objectContaining({
          jobHuntSearch: expect.objectContaining({ roles: ['EM'] }),
        }),
      }),
    )
  })
})
