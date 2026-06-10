import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({
  requireProfile: vi.fn().mockResolvedValue({
    profile: {
      id: 'profile-1',
      name: 'Test User',
      headline: 'Software Engineer',
      email: 'test@example.com',
      phone: null,
      linkedIn: null,
      website: null,
    },
  }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    coverLetterDocument: {
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    jobApplication: {
      findFirst: vi.fn(),
    },
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createCoverLetter, updateCoverLetterContent, deleteCoverLetter, linkJobToCoverLetter } from './actions'
import { prisma } from '@/lib/db'

const mockCreate = vi.mocked(prisma.coverLetterDocument.create)
const mockUpdateMany = vi.mocked(prisma.coverLetterDocument.updateMany)
const mockDeleteMany = vi.mocked(prisma.coverLetterDocument.deleteMany)
const mockJobFind = vi.mocked(prisma.jobApplication.findFirst)

describe('createCoverLetter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a standalone letter with no job link', async () => {
    mockCreate.mockResolvedValue({ id: 'cl-1' } as never)
    const result = await createCoverLetter()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileId: 'profile-1',
          jobApplicationId: null,
          mode: 'markdown',
          status: 'draft',
          content: expect.stringContaining('# Test User'),
          jobTitle: null,
          company: null,
        }),
        select: { id: true },
      })
    )
    expect(result).toEqual({ id: 'cl-1' })
  })

  it('copies job title and company when jobApplicationId is provided', async () => {
    mockJobFind.mockResolvedValue({ title: 'Senior PM', company: 'Acme' } as never)
    mockCreate.mockResolvedValue({ id: 'cl-2' } as never)
    await createCoverLetter('job-1')
    expect(mockJobFind).toHaveBeenCalledWith({
      where: { id: 'job-1', profileId: 'profile-1' },
      select: { title: true, company: true },
    })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobApplicationId: 'job-1',
          jobTitle: 'Senior PM',
          company: 'Acme',
        }),
      })
    )
  })

  it('creates letter with null title/company when job not found', async () => {
    mockJobFind.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 'cl-3' } as never)
    await createCoverLetter('job-missing')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jobTitle: null, company: null }),
      })
    )
  })
})

describe('updateCoverLetterContent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates content with profileId auth guard', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 })
    await updateCoverLetterContent('cl-1', 'Dear Hiring Manager,')
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'cl-1', profileId: 'profile-1' },
      data: { content: 'Dear Hiring Manager,' },
    })
  })

  it('throws when cover letter not found for this profile', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 })
    await expect(updateCoverLetterContent('cl-none', 'text')).rejects.toThrow('Cover letter not found')
  })
})

describe('linkJobToCoverLetter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('links job and copies title/company with auth guards', async () => {
    mockJobFind.mockResolvedValue({ title: 'Staff Engineer', company: 'Acme' } as never)
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const result = await linkJobToCoverLetter('cl-1', 'job-1')
    expect(mockJobFind).toHaveBeenCalledWith({
      where: { id: 'job-1', profileId: 'profile-1' },
      select: { title: true, company: true },
    })
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'cl-1', profileId: 'profile-1' },
      data: { jobApplicationId: 'job-1', jobTitle: 'Staff Engineer', company: 'Acme' },
    })
    expect(result).toEqual({ jobTitle: 'Staff Engineer', company: 'Acme' })
  })

  it('throws when the job does not belong to this profile', async () => {
    mockJobFind.mockResolvedValue(null)
    await expect(linkJobToCoverLetter('cl-1', 'job-x')).rejects.toThrow('Job not found')
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('throws when the cover letter is not found for this profile', async () => {
    mockJobFind.mockResolvedValue({ title: 'PM', company: null } as never)
    mockUpdateMany.mockResolvedValue({ count: 0 })
    await expect(linkJobToCoverLetter('cl-none', 'job-1')).rejects.toThrow('Cover letter not found')
  })
})

describe('deleteCoverLetter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes with profileId auth guard', async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 })
    await deleteCoverLetter('cl-1')
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: 'cl-1', profileId: 'profile-1' },
    })
  })

  it('throws when cover letter not found for this profile', async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 })
    await expect(deleteCoverLetter('cl-none')).rejects.toThrow('Cover letter not found')
  })
})
