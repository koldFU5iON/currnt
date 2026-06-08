import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({
  requireProfile: vi.fn().mockResolvedValue({ profile: { id: 'profile-1' } }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    interviewPrepSession: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn() },
    prepNote: { create: vi.fn(), count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    prepDocument: { create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    prepInterviewer: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
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
const mockSessionFindFirst = vi.mocked(prisma.interviewPrepSession.findFirst)
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
    mockSessionFindFirst.mockResolvedValue({ id: 'sess-1' } as never)
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

import {
  addDocument, deleteDocument,
  addInterviewer, updateInterviewer, deleteInterviewer,
} from './actions'

const mockDocCreate = vi.mocked(prisma.prepDocument.create)
const mockDocFindFirst = vi.mocked(prisma.prepDocument.findFirst)
const mockDocDelete = vi.mocked(prisma.prepDocument.deleteMany)
const mockInterviewerCreate = vi.mocked(prisma.prepInterviewer.create)
const mockInterviewerFindFirst = vi.mocked(prisma.prepInterviewer.findFirst)
const mockInterviewerUpdate = vi.mocked(prisma.prepInterviewer.updateMany)
const mockInterviewerDelete = vi.mocked(prisma.prepInterviewer.deleteMany)

describe('addDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a document scoped to session and profile', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 'sess-1' } as never)
    mockDocCreate.mockResolvedValue({ id: 'doc-1' } as never)
    const result = await addDocument('sess-1', {
      name: 'Interview Pack', docType: 'interview-pack', content: 'Lorem ipsum',
    })
    expect(mockDocCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionId: 'sess-1', profileId: 'profile-1',
          name: 'Interview Pack', docType: 'interview-pack', content: 'Lorem ipsum',
        }),
      })
    )
    expect(result).toEqual({ id: 'doc-1' })
  })
})

describe('deleteDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes scoped to profileId and revalidates session path', async () => {
    mockDocFindFirst.mockResolvedValue({ sessionId: 'sess-1' } as never)
    mockDocDelete.mockResolvedValue({ count: 1 } as never)
    await deleteDocument('doc-1')
    expect(mockDocFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'doc-1', profileId: 'profile-1' } })
    )
    expect(mockDocDelete).toHaveBeenCalledWith({
      where: { id: 'doc-1', profileId: 'profile-1' },
    })
  })

  it('does nothing if document not found', async () => {
    mockDocFindFirst.mockResolvedValue(null)
    await deleteDocument('doc-missing')
    expect(mockDocDelete).not.toHaveBeenCalled()
  })
})

describe('addInterviewer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an interviewer record', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 'sess-1' } as never)
    mockInterviewerCreate.mockResolvedValue({ id: 'int-1' } as never)
    const result = await addInterviewer('sess-1', { name: 'Sarah Chen', role: 'Head of Design' })
    expect(mockInterviewerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionId: 'sess-1', profileId: 'profile-1', name: 'Sarah Chen' }),
      })
    )
    expect(result).toEqual({ id: 'int-1' })
  })
})

describe('updateInterviewer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates scoped to profileId', async () => {
    mockInterviewerUpdate.mockResolvedValue({ count: 1 } as never)
    await updateInterviewer('int-1', { linkedInText: 'Sarah is...' })
    expect(mockInterviewerUpdate).toHaveBeenCalledWith({
      where: { id: 'int-1', profileId: 'profile-1' },
      data: { linkedInText: 'Sarah is...' },
    })
  })
})

describe('deleteInterviewer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes scoped to profileId and revalidates session path', async () => {
    mockInterviewerFindFirst.mockResolvedValue({ sessionId: 'sess-1' } as never)
    mockInterviewerDelete.mockResolvedValue({ count: 1 } as never)
    await deleteInterviewer('int-1')
    expect(mockInterviewerFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'int-1', profileId: 'profile-1' } })
    )
    expect(mockInterviewerDelete).toHaveBeenCalledWith({
      where: { id: 'int-1', profileId: 'profile-1' },
    })
  })

  it('does nothing if interviewer not found', async () => {
    mockInterviewerFindFirst.mockResolvedValue(null)
    await deleteInterviewer('int-missing')
    expect(mockInterviewerDelete).not.toHaveBeenCalled()
  })
})

import {
  addTextBlock, updateBlock, deleteBlock, moveBlockUp, moveBlockDown, convertAiBlockToText, insertAiBlock,
} from './actions'

const mockNoteFind = vi.mocked(prisma.prepNote.findFirst)
const mockNoteUpdate = vi.mocked(prisma.prepNote.update)

describe('addTextBlock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('appends a new text block to the note sections', async () => {
    const existingSections = [{ id: 'b1', type: 'text', title: 'Existing', content: 'hi', order: 0 }]
    mockNoteFind.mockResolvedValue({ id: 'note-1', sessionId: 'sess-1', sections: existingSections } as never)
    mockNoteUpdate.mockResolvedValue({} as never)

    await addTextBlock('note-1')

    const updateCall = mockNoteUpdate.mock.calls[0][0]
    const sections = (updateCall.data as { sections: unknown }).sections as Array<{ type: string; order: number }>
    expect(sections).toHaveLength(2)
    expect(sections[1].type).toBe('text')
    expect(sections[1].order).toBe(1)
  })
})

describe('updateBlock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates matching block content', async () => {
    const sections = [{ id: 'b1', type: 'text', title: 'Old', content: '', order: 0 }]
    mockNoteFind.mockResolvedValue({ id: 'note-1', sessionId: 'sess-1', sections } as never)
    mockNoteUpdate.mockResolvedValue({} as never)

    await updateBlock('note-1', 'b1', { content: 'Updated content' })

    const updateCall = mockNoteUpdate.mock.calls[0][0]
    const updated = (updateCall.data as { sections: unknown }).sections as Array<{ id: string; content: string }>
    expect(updated[0].content).toBe('Updated content')
  })
})

describe('deleteBlock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('removes the block and resets order', async () => {
    const sections = [
      { id: 'b1', type: 'text', title: 'A', content: '', order: 0 },
      { id: 'b2', type: 'text', title: 'B', content: '', order: 1 },
    ]
    mockNoteFind.mockResolvedValue({ id: 'note-1', sessionId: 'sess-1', sections } as never)
    mockNoteUpdate.mockResolvedValue({} as never)

    await deleteBlock('note-1', 'b1')

    const updateCall = mockNoteUpdate.mock.calls[0][0]
    const updated = (updateCall.data as { sections: unknown }).sections as Array<{ id: string; order: number }>
    expect(updated).toHaveLength(1)
    expect(updated[0].id).toBe('b2')
    expect(updated[0].order).toBe(0)
  })
})

describe('moveBlockUp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('swaps a block with the one above it', async () => {
    const sections = [
      { id: 'b1', type: 'text', title: 'A', content: '', order: 0 },
      { id: 'b2', type: 'text', title: 'B', content: '', order: 1 },
    ]
    mockNoteFind.mockResolvedValue({ id: 'note-1', sessionId: 'sess-1', sections } as never)
    mockNoteUpdate.mockResolvedValue({} as never)

    await moveBlockUp('note-1', 'b2')

    const updateCall = mockNoteUpdate.mock.calls[0][0]
    const updated = (updateCall.data as { sections: unknown }).sections as Array<{ id: string; order: number }>
    const sorted = [...updated].sort((a, b) => a.order - b.order)
    expect(sorted[0].id).toBe('b2')
    expect(sorted[1].id).toBe('b1')
  })

  it('does nothing if block is already first', async () => {
    const sections = [{ id: 'b1', type: 'text', title: 'A', content: '', order: 0 }]
    mockNoteFind.mockResolvedValue({ id: 'note-1', sessionId: 'sess-1', sections } as never)
    await moveBlockUp('note-1', 'b1')
    expect(mockNoteUpdate).not.toHaveBeenCalled()
  })
})

describe('moveBlockDown', () => {
  beforeEach(() => vi.clearAllMocks())

  it('swaps a block with the one below it', async () => {
    const sections = [
      { id: 'b1', type: 'text', title: 'A', content: '', order: 0 },
      { id: 'b2', type: 'text', title: 'B', content: '', order: 1 },
    ]
    mockNoteFind.mockResolvedValue({ id: 'note-1', sessionId: 'sess-1', sections } as never)
    mockNoteUpdate.mockResolvedValue({} as never)

    await moveBlockDown('note-1', 'b1')

    const updateCall = mockNoteUpdate.mock.calls[0][0]
    const updated = (updateCall.data as { sections: unknown }).sections as Array<{ id: string; order: number }>
    const sorted = [...updated].sort((a, b) => a.order - b.order)
    expect(sorted[0].id).toBe('b2')
    expect(sorted[1].id).toBe('b1')
  })

  it('does nothing if block is already last', async () => {
    const sections = [{ id: 'b1', type: 'text', title: 'A', content: '', order: 0 }]
    mockNoteFind.mockResolvedValue({ id: 'note-1', sessionId: 'sess-1', sections } as never)
    await moveBlockDown('note-1', 'b1')
    expect(mockNoteUpdate).not.toHaveBeenCalled()
  })
})

describe('convertAiBlockToText', () => {
  beforeEach(() => vi.clearAllMocks())

  it('converts an ai-analysis block to text type', async () => {
    const sections = [
      { id: 'b1', type: 'ai-analysis', title: 'AI Block', content: 'AI content', sourceDocIds: [], sourceInterviewerIds: [], order: 0 },
    ]
    mockNoteFind.mockResolvedValue({ id: 'note-1', sessionId: 'sess-1', sections } as never)
    mockNoteUpdate.mockResolvedValue({} as never)

    await convertAiBlockToText('note-1', 'b1')

    const updateCall = mockNoteUpdate.mock.calls[0][0]
    const updated = (updateCall.data as { sections: unknown }).sections as Array<{ id: string; type: string }>
    expect(updated[0].type).toBe('text')
  })

  it('does not change a text block', async () => {
    const sections = [
      { id: 'b1', type: 'text', title: 'Text Block', content: 'content', order: 0 },
    ]
    mockNoteFind.mockResolvedValue({ id: 'note-1', sessionId: 'sess-1', sections } as never)
    mockNoteUpdate.mockResolvedValue({} as never)

    await convertAiBlockToText('note-1', 'b1')

    const updateCall = mockNoteUpdate.mock.calls[0][0]
    const updated = (updateCall.data as { sections: unknown }).sections as Array<{ id: string; type: string }>
    expect(updated[0].type).toBe('text')
  })
})

describe('insertAiBlock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts an ai-analysis block at end with source ids', async () => {
    const sections: never[] = []
    mockNoteFind.mockResolvedValue({ id: 'note-1', sessionId: 'sess-1', sections } as never)
    mockNoteUpdate.mockResolvedValue({} as never)

    await insertAiBlock('note-1', {
      title: '✦ Interview Pack',
      content: 'AI insights here',
      sourceDocIds: ['doc-1'],
      sourceInterviewerIds: [],
    })

    const updateCall = mockNoteUpdate.mock.calls[0][0]
    const updated = (updateCall.data as { sections: unknown }).sections as Array<{ type: string; title: string; sourceDocIds: string[] }>
    expect(updated[0].type).toBe('ai-analysis')
    expect(updated[0].title).toBe('✦ Interview Pack')
    expect(updated[0].sourceDocIds).toEqual(['doc-1'])
  })
})
