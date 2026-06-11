import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({
  requireProfile: vi.fn().mockResolvedValue({ profile: { id: 'profile-1' } }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    companyWatch: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    discoveredJob: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    jobApplication: { create: vi.fn() },
    userSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    experience: { findMany: vi.fn().mockResolvedValue([]) },
    skill: { findMany: vi.fn().mockResolvedValue([]) },
    profile: { findUnique: vi.fn().mockResolvedValue({ headline: null }) },
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('./ats-discovery', () => ({ discoverAts: vi.fn() }))
vi.mock('./adapters/index', () => ({ getAdapter: vi.fn() }))
vi.mock('@/modules/llm/client', () => ({
  completeStructured: vi.fn(),
}))
vi.mock('@/modules/profile/snapshot', () => ({
  buildProfileSnapshot: vi.fn().mockResolvedValue({}),
  serializeProfileForLLM: vi.fn().mockReturnValue('profile text'),
}))
vi.mock('@/modules/llm/prompt-context', () => ({
  loadWritingRules: vi.fn().mockResolvedValue(''),
  composeSystem: vi.fn().mockReturnValue('system'),
}))
vi.mock('@/modules/onboarding/schema', () => ({
  normalizeOnboardingContext: vi.fn().mockReturnValue({
    targetRole: 'Senior Engineer',
    currentRole: '',
    industries: '',
    workPreferences: '',
    extraContext: '',
    preferredName: '',
  }),
}))

import { addCompany, scanCompany, importJob, ignoreJob, addCompanyFromHint, getAtsHintFromUrl, removeWatch } from './actions'
import { prisma } from '@/lib/db'
import { discoverAts } from './ats-discovery'
import { getAdapter } from './adapters/index'

const mockDiscoverAts = vi.mocked(discoverAts)
const mockGetAdapter = vi.mocked(getAdapter)
const mockCreate = vi.mocked(prisma.companyWatch.create)
const mockFindFirst = vi.mocked(prisma.companyWatch.findFirst)
const mockJobCreate = vi.mocked(prisma.jobApplication.create)
const mockDiscoveredFindFirst = vi.mocked(prisma.discoveredJob.findFirst)
const mockDiscoveredUpdate = vi.mocked(prisma.discoveredJob.update)

describe('addCompany', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls discoverAts and creates CompanyWatch', async () => {
    mockDiscoverAts.mockResolvedValueOnce({
      provider: 'greenhouse',
      boardSlug: 'acme',
      careersUrl: 'https://boards.greenhouse.io/acme',
      confidence: 0.9,
      reasoning: 'found greenhouse',
    })
    mockCreate.mockResolvedValueOnce({ id: 'watch-1' } as never)

    const result = await addCompany({ name: 'Acme', website: 'https://acme.com' })

    expect(result.ok).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Acme',
          atsProvider: 'greenhouse',
          boardSlug: 'acme',
          profileId: 'profile-1',
        }),
      }),
    )
  })

  it('sets status discovery_failed when provider is unknown', async () => {
    mockDiscoverAts.mockResolvedValueOnce({
      provider: 'unknown', confidence: 0, reasoning: 'not found',
    })
    mockCreate.mockResolvedValueOnce({ id: 'watch-2' } as never)

    const result = await addCompany({ name: 'NoATS', website: 'https://noats.com' })

    expect(result.ok).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'discovery_failed' }),
      }),
    )
  })
})

describe('scanCompany', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns not_found when watch does not exist', async () => {
    mockFindFirst.mockResolvedValueOnce(null)
    const result = await scanCompany('nonexistent')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('returns no_ats_detected when boardSlug is null', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'w1', profileId: 'profile-1', atsProvider: 'unknown', boardSlug: null, name: 'X', status: 'active',
    } as never)
    const result = await scanCompany('w1')
    expect(result).toEqual({ ok: false, error: 'no_ats_detected' })
  })

  it('returns fetch_failed when adapter throws', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'w1', profileId: 'profile-1', atsProvider: 'greenhouse', boardSlug: 'acme', name: 'Acme', status: 'active',
    } as never)
    mockGetAdapter.mockReturnValueOnce({
      fetchJobList: vi.fn().mockRejectedValue(new Error('network')),
      fetchDescription: vi.fn(),
    })
    vi.mocked(prisma.discoveredJob.findMany).mockResolvedValueOnce([])

    const result = await scanCompany('w1')
    expect(result).toEqual({ ok: false, error: 'fetch_failed' })
  })
})

describe('importJob', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a JobApplication and marks discovered job as imported', async () => {
    mockDiscoveredFindFirst.mockResolvedValueOnce({
      id: 'dj-1', profileId: 'profile-1', title: 'Engineer', company: 'Acme',
      location: 'Remote', url: 'https://x.com', description: 'desc',
      postedAt: new Date('2026-01-01'), fitLabel: null, fitScore: null,
      fitJustification: null, status: 'new',
    } as never)
    mockJobCreate.mockResolvedValueOnce({ id: 'ja-1' } as never)
    vi.mocked(prisma.discoveredJob.updateMany).mockResolvedValueOnce({ count: 1 })

    const result = await importJob('dj-1')

    expect(result).toMatchObject({ ok: true, jobId: 'ja-1' })
    expect(mockJobCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Engineer',
          company: 'Acme',
          applicationSource: 'cold',
        }),
      }),
    )
    expect(vi.mocked(prisma.discoveredJob.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'dj-1', profileId: 'profile-1' }),
        data: expect.objectContaining({ status: 'imported', importedJobId: 'ja-1' }),
      }),
    )
  })
})

describe('ignoreJob', () => {
  it('sets status to ignored via updateMany', async () => {
    vi.mocked(prisma.discoveredJob.updateMany).mockResolvedValueOnce({ count: 1 })

    await ignoreJob('dj-1')

    expect(vi.mocked(prisma.discoveredJob.updateMany)).toHaveBeenCalledWith({
      where: { id: 'dj-1', profileId: 'profile-1' },
      data: { status: 'ignored' },
    })
  })
})

describe('addCompanyFromHint', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates CompanyWatch with confidence 1 and active status', async () => {
    vi.mocked(prisma.companyWatch.create).mockResolvedValueOnce({ id: 'watch-3' } as never)

    const result = await addCompanyFromHint({
      provider: 'greenhouse',
      boardSlug: 'acme',
      name: 'Acme Corp',
    })

    expect(result.ok).toBe(true)
    expect(vi.mocked(prisma.companyWatch.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          atsProvider: 'greenhouse',
          boardSlug: 'acme',
          confidence: 1,
          status: 'active',
        }),
      }),
    )
  })
})

describe('getAtsHintFromUrl', () => {
  it('detects Greenhouse from URL', async () => {
    const hint = await getAtsHintFromUrl(
      'https://boards.greenhouse.io/acme/jobs/123',
      'Acme',
    )
    expect(hint).not.toBeNull()
    expect(hint?.provider).toBe('greenhouse')
    expect(hint?.name).toBe('Acme')
  })

  it('returns null for non-ATS URLs', async () => {
    const hint = await getAtsHintFromUrl('https://acme.com/jobs/engineer', 'Acme')
    expect(hint).toBeNull()
  })
})

describe('removeWatch', () => {
  it('calls deleteMany with profileId guard', async () => {
    vi.mocked(prisma.companyWatch.deleteMany).mockResolvedValueOnce({ count: 1 })

    await removeWatch('watch-1')

    expect(vi.mocked(prisma.companyWatch.deleteMany)).toHaveBeenCalledWith({
      where: { id: 'watch-1', profileId: 'profile-1' },
    })
  })
})
