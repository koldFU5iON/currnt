import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({
  requireProfile: vi.fn().mockResolvedValue({ profile: { id: 'profile-1' } }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    interviewPrepSession: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    prepNote: { create: vi.fn(), count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    prepDocument: { create: vi.fn(), deleteMany: vi.fn() },
    prepInterviewer: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    jobApplication: { findFirst: vi.fn() },
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  createSession, updateSessionDetails, linkSessionToJob, deleteSession,
  createNote, renameNote, deleteNote,
} from './actions'
import { prisma } from '@/lib/db'

const mockSessionCreate = vi.mocked(prisma.interviewPrepSession.create)
const mockNoteCreate = vi.mocked(prisma.prepNote.create)
const mockNoteCount = vi.mocked(prisma.prepNote.count)
const mockSessionUpdate = vi.mocked(prisma.interviewPrepSession.updateMany)
const mockSessionDelete = vi.mocked(prisma.interviewPrepSession.deleteMany)
const mockNoteUpdateMany = vi.mocked(prisma.prepNote.updateMany)
const mockNoteDeleteMany = vi.mocked(prisma.prepNote.deleteMany)
const mockJobFind = vi.mocked(prisma.jobApplication.findFirst)

describe('createSession', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a session and a default PrepNote', async () => {
    mockSessionCreate.mockResolvedValue({ id: 'sess-1' } as never)
    mockNoteCreate.mockResolvedValue({ id: 'note-1' } as never)
    mockNoteCount.mockResolvedValue(0)
    const result = await createSession({ title: 'PM @ Acme' })
    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ profileId: 'profile-1', title: 'PM @ Acme' }) })
    )
    expect(mockNoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sessionId: 'sess-1', profileId: 'profile-1', title: 'Prep Notes', order: 0 }) })
    )
    expect(result).toEqual({ id: 'sess-1' })
  })

  it('auto-fills company/jobTitle from linked job', async () => {
    mockJobFind.mockResolvedValue({ title: 'Senior PM', company: 'Stripe' } as never)
    mockSessionCreate.mockResolvedValue({ id: 'sess-2' } as never)
    mockNoteCreate.mockResolvedValue({ id: 'note-2' } as never)
    mockNoteCount.mockResolvedValue(0)
    await createSession({ title: 'Senior PM @ Stripe', jobApplicationId: 'job-1' })
    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jobTitle: 'Senior PM', company: 'Stripe', jobApplicationId: 'job-1' }),
      })
    )
  })
})

describe('updateSessionDetails', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates scoped to profileId', async () => {
    mockSessionUpdate.mockResolvedValue({ count: 1 } as never)
    await updateSessionDetails('sess-1', { title: 'Updated' })
    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { id: 'sess-1', profileId: 'profile-1' },
      data: { title: 'Updated' },
    })
  })
})

describe('deleteSession', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes scoped to profileId', async () => {
    mockSessionDelete.mockResolvedValue({ count: 1 } as never)
    await deleteSession('sess-1')
    expect(mockSessionDelete).toHaveBeenCalledWith({
      where: { id: 'sess-1', profileId: 'profile-1' },
    })
  })
})

describe('createNote', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a note with the correct session and profile', async () => {
    mockNoteCreate.mockResolvedValue({ id: 'note-3' } as never)
    mockNoteCount.mockResolvedValue(2)
    const result = await createNote('sess-1', 'Hiring Manager')
    expect(mockNoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionId: 'sess-1', profileId: 'profile-1', title: 'Hiring Manager', order: 2 }),
      })
    )
    expect(result).toEqual({ id: 'note-3' })
  })
})

describe('renameNote', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renames scoped to profileId', async () => {
    mockNoteUpdateMany.mockResolvedValue({ count: 1 } as never)
    await renameNote('note-1', 'Technical Round')
    expect(mockNoteUpdateMany).toHaveBeenCalledWith({
      where: { id: 'note-1', profileId: 'profile-1' },
      data: { title: 'Technical Round' },
    })
  })
})

describe('deleteNote', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes scoped to profileId', async () => {
    mockNoteDeleteMany.mockResolvedValue({ count: 1 } as never)
    await deleteNote('note-1')
    expect(mockNoteDeleteMany).toHaveBeenCalledWith({
      where: { id: 'note-1', profileId: 'profile-1' },
    })
  })
})
