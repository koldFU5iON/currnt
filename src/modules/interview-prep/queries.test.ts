import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    interviewPrepSession: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { listSessions, getSession } from './queries'
import { prisma } from '@/lib/db'

const mockFindMany = vi.mocked(prisma.interviewPrepSession.findMany)
const mockFindFirst = vi.mocked(prisma.interviewPrepSession.findFirst)

describe('listSessions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries by profileId ordered by updatedAt desc', async () => {
    mockFindMany.mockResolvedValue([])
    await listSessions('profile-1')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: 'profile-1' },
        orderBy: { updatedAt: 'desc' },
      })
    )
  })

  it('returns list items', async () => {
    const rows = [
      {
        id: 's1', title: 'PM @ Acme', company: 'Acme', jobTitle: 'PM',
        status: 'draft', createdAt: new Date(), updatedAt: new Date(),
        _count: { notes: 2, documents: 1, interviewers: 1 },
      },
    ]
    mockFindMany.mockResolvedValue(rows as never)
    const result = await listSessions('profile-1')
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('PM @ Acme')
  })
})

describe('getSession', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries by id and profileId', async () => {
    mockFindFirst.mockResolvedValue(null)
    await getSession('profile-1', 'session-1')
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1', profileId: 'profile-1' },
      })
    )
  })

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(null)
    const result = await getSession('profile-1', 'session-1')
    expect(result).toBeNull()
  })
})
