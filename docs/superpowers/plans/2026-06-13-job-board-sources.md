# Job Board Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Job Board Sources column to the Job Hunt page (Remotive, RemoteOK, Adzuna, JSearch), a universal search bar spanning all three columns, and a Manual Sources tile — all feeding the existing Discovered Roles queue.

**Architecture:** New `JobBoardSource` Prisma model. `DiscoveredJob.watchId` becomes nullable; new `boardSourceId` FK added. Board adapters in `src/modules/job-hunt/board-adapters/` follow the same interface pattern as ATS adapters. Search criteria stored in `UserSettings.jobHuntSearch`. JSearch API key stored encrypted in `UserSettings.jobBoardApiKeys`. New settings page at `/dashboard/settings/job-boards`. Page redesigned to three-column layout.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + PostgreSQL, Zod, Tailwind v4 + shadcn/ui, Vitest, Sonner toasts.

---

## File Map

**Create:**
- `prisma/schema/job-hunt.prisma` — add `JobBoardSource`, modify `DiscoveredJob`
- `src/modules/job-hunt/board-sources/schema.ts` — Zod schemas for board sources + search criteria
- `src/modules/job-hunt/board-sources/schema.test.ts`
- `src/modules/job-hunt/board-sources/queries.ts` — `getBoardSources`, `ensureBoardSources`, `getJobHuntSearch`
- `src/modules/job-hunt/board-sources/actions.ts` — `toggleBoardSource`, `scanBoardSource`, `saveJobHuntSearch`
- `src/modules/job-hunt/board-sources/actions.test.ts`
- `src/modules/job-hunt/board-adapters/index.ts`
- `src/modules/job-hunt/board-adapters/remotive.ts`
- `src/modules/job-hunt/board-adapters/remotive.test.ts`
- `src/modules/job-hunt/board-adapters/remoteok.ts`
- `src/modules/job-hunt/board-adapters/remoteok.test.ts`
- `src/modules/job-hunt/board-adapters/adzuna.ts`
- `src/modules/job-hunt/board-adapters/adzuna.test.ts`
- `src/modules/job-hunt/board-adapters/jsearch.ts`
- `src/modules/job-hunt/board-adapters/jsearch.test.ts`
- `src/app/dashboard/settings/job-boards/page.tsx`
- `src/app/dashboard/settings/job-boards/_components/job-boards-form.tsx`
- `src/app/dashboard/job-hunt/_components/search-criteria-bar.tsx`
- `src/app/dashboard/job-hunt/_components/job-board-sources.tsx`
- `src/app/dashboard/job-hunt/_components/board-source-row.tsx`
- `src/app/dashboard/job-hunt/_components/manual-sources-tile.tsx`

**Modify:**
- `prisma/schema/settings.prisma` — add `jobHuntSearch Json?` + `jobBoardApiKeys Json?`
- `prisma/schema/profile.prisma` — add `jobBoardSources JobBoardSource[]` back-relation
- `src/modules/job-hunt/queries.ts` — update `getDiscoveredJobs` for nullable watchId + board source include
- `src/modules/job-hunt/actions.ts` — extend `scanAll` to cover board sources
- `src/app/dashboard/job-hunt/page.tsx` — three-column layout + search bar
- `src/app/dashboard/job-hunt/_components/discovered-jobs.tsx` — filter tabs, source pill
- `src/app/dashboard/job-hunt/_components/job-queue-row.tsx` — source pill, salary tag
- `src/app/dashboard/job-hunt/_components/sync-all-button.tsx` — updated toast copy
- `src/app/dashboard/settings/page.tsx` — add Job Boards link

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema/job-hunt.prisma`
- Modify: `prisma/schema/settings.prisma`
- Modify: `prisma/schema/profile.prisma`

- [ ] **Step 1: Update `job-hunt.prisma`**

Replace the entire file content with:

```prisma
// prisma/schema/job-hunt.prisma

model CompanyWatch {
  id              String    @id @default(cuid())
  profileId       String
  name            String
  website         String
  careersUrl      String?
  atsProvider     String    @default("unknown")
  boardSlug       String?
  confidence      Float     @default(0)
  status          String    @default("active")
  searchLocations String[]  @default([])
  includeRemote   Boolean   @default(true)
  lastScannedAt   DateTime?
  createdAt       DateTime  @default(now())

  profile        Profile         @relation(fields: [profileId], references: [id], onDelete: Cascade)
  discoveredJobs DiscoveredJob[]

  @@index([profileId])
  @@index([profileId, status])
}

// provider values: 'remotive' | 'remoteok' | 'adzuna' | 'jsearch'
// 'web-search' is reserved for Issue #216 (agentic sweep — not yet implemented)
model JobBoardSource {
  id            String    @id @default(cuid())
  profileId     String
  provider      String
  enabled       Boolean   @default(true)
  lastScannedAt DateTime?
  createdAt     DateTime  @default(now())

  profile        Profile         @relation(fields: [profileId], references: [id], onDelete: Cascade)
  discoveredJobs DiscoveredJob[]

  @@unique([profileId, provider])
  @@index([profileId])
}

model DiscoveredJob {
  id               String    @id @default(cuid())
  watchId          String?
  boardSourceId    String?
  profileId        String
  externalId       String
  title            String
  company          String
  location         String?
  salary           String?
  url              String?
  postedAt         DateTime?
  description      String?
  fitScore         Float?
  fitLabel         String?
  fitJustification String?
  status           String    @default("new")
  importedJobId    String?
  createdAt        DateTime  @default(now())

  watch       CompanyWatch?   @relation(fields: [watchId], references: [id], onDelete: Cascade)
  boardSource JobBoardSource? @relation(fields: [boardSourceId], references: [id], onDelete: Cascade)
  profile     Profile         @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([watchId, externalId])
  @@unique([boardSourceId, externalId])
  @@index([profileId])
  @@index([profileId, status])
  @@index([watchId])
  @@index([boardSourceId])
}
```

- [ ] **Step 2: Add fields to `settings.prisma`**

Inside `model UserSettings { ... }`, add two lines after the `onboardingContext` field:

```prisma
  /// Universal search criteria for Job Hunt page. Shape: JobHuntSearchCriteria in src/modules/job-hunt/board-sources/schema.ts
  jobHuntSearch     Json?
  /// Encrypted API keys for paid job board sources. Shape: { jsearch?: string }
  jobBoardApiKeys   Json?
```

- [ ] **Step 3: Add back-relation to `profile.prisma`**

Inside `model Profile { ... }`, add after the existing `discoveredJobs` relation:

```prisma
  jobBoardSources JobBoardSource[]
```

- [ ] **Step 4: Run migration**

```bash
npm run db:migrate -- --name add_job_board_sources
```

Expected: new migration file in `prisma/migrations/`, DB updated with `JobBoardSource` table and modified `DiscoveredJob` columns.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema/job-hunt.prisma prisma/schema/settings.prisma prisma/schema/profile.prisma prisma/migrations/
git commit -m "feat(job-board-sources): add JobBoardSource model, nullable watchId, salary field"
```

---

## Task 2: Board sources Zod schemas

**Files:**
- Create: `src/modules/job-hunt/board-sources/schema.ts`
- Create: `src/modules/job-hunt/board-sources/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/job-hunt/board-sources/schema.test.ts
import { describe, it, expect } from 'vitest'
import {
  BOARD_PROVIDERS,
  JobHuntSearchCriteriaSchema,
  BoardJobListingSchema,
  normalizeJobHuntSearch,
} from './schema'

describe('BOARD_PROVIDERS', () => {
  it('includes all four initial providers', () => {
    expect(BOARD_PROVIDERS).toContain('remotive')
    expect(BOARD_PROVIDERS).toContain('remoteok')
    expect(BOARD_PROVIDERS).toContain('adzuna')
    expect(BOARD_PROVIDERS).toContain('jsearch')
  })
})

describe('JobHuntSearchCriteriaSchema', () => {
  it('accepts a full valid criteria object', () => {
    const r = JobHuntSearchCriteriaSchema.safeParse({
      roles: ['Engineering Manager', 'Operations Manager'],
      locations: ['Ireland', 'Remote'],
      datePosted: 'last30',
      minSalary: 90000,
    })
    expect(r.success).toBe(true)
  })

  it('accepts null minSalary', () => {
    const r = JobHuntSearchCriteriaSchema.safeParse({
      roles: ['Engineer'],
      locations: [],
      datePosted: 'any',
      minSalary: null,
    })
    expect(r.success).toBe(true)
  })

  it('rejects invalid datePosted value', () => {
    const r = JobHuntSearchCriteriaSchema.safeParse({
      roles: [],
      locations: [],
      datePosted: 'yesterday',
      minSalary: null,
    })
    expect(r.success).toBe(false)
  })
})

describe('normalizeJobHuntSearch', () => {
  it('returns defaults when called with null', () => {
    const result = normalizeJobHuntSearch(null)
    expect(result.roles).toEqual([])
    expect(result.locations).toEqual([])
    expect(result.datePosted).toBe('last30')
    expect(result.minSalary).toBeNull()
  })

  it('returns parsed value when valid JSON passed', () => {
    const input = { roles: ['EM'], locations: ['IE'], datePosted: 'last7', minSalary: 80000 }
    const result = normalizeJobHuntSearch(input)
    expect(result.roles).toEqual(['EM'])
    expect(result.datePosted).toBe('last7')
  })
})

describe('BoardJobListingSchema', () => {
  it('accepts a full listing with salary', () => {
    const r = BoardJobListingSchema.safeParse({
      externalId: 'abc-123',
      title: 'Engineering Manager',
      company: 'Acme Corp',
      location: 'Dublin, Ireland',
      url: 'https://example.com/job/abc-123',
      postedAt: new Date(),
      salary: '$180,000 - $220,000',
    })
    expect(r.success).toBe(true)
  })

  it('accepts null optional fields', () => {
    const r = BoardJobListingSchema.safeParse({
      externalId: '1',
      title: 'Engineer',
      company: 'Co',
      location: null,
      url: 'https://x.com',
      postedAt: null,
      salary: null,
    })
    expect(r.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/job-hunt/board-sources/schema.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Write the schema module**

```ts
// src/modules/job-hunt/board-sources/schema.ts
import * as z from 'zod'

export const BOARD_PROVIDERS = ['remotive', 'remoteok', 'adzuna', 'jsearch'] as const
export type BoardProvider = typeof BOARD_PROVIDERS[number]

export const DATE_POSTED_OPTIONS = ['last7', 'last30', 'last90', 'any'] as const
export type DatePosted = typeof DATE_POSTED_OPTIONS[number]

export const JobHuntSearchCriteriaSchema = z.object({
  roles: z.array(z.string()),
  locations: z.array(z.string()),
  datePosted: z.enum(DATE_POSTED_OPTIONS),
  minSalary: z.number().nullable(),
})
export type JobHuntSearchCriteria = z.infer<typeof JobHuntSearchCriteriaSchema>

const DEFAULT_CRITERIA: JobHuntSearchCriteria = {
  roles: [],
  locations: [],
  datePosted: 'last30',
  minSalary: null,
}

export function normalizeJobHuntSearch(raw: unknown): JobHuntSearchCriteria {
  const result = JobHuntSearchCriteriaSchema.safeParse(raw)
  return result.success ? result.data : DEFAULT_CRITERIA
}

export const BoardJobListingSchema = z.object({
  externalId: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  url: z.string(),
  postedAt: z.date().nullable(),
  salary: z.string().nullable(),
})
export type BoardJobListing = z.infer<typeof BoardJobListingSchema>

// Shape stored in UserSettings.jobBoardApiKeys (each value AES-GCM encrypted)
export const JobBoardApiKeysSchema = z.object({
  jsearch: z.string().optional(),
})
export type JobBoardApiKeys = z.infer<typeof JobBoardApiKeysSchema>

export function normalizeJobBoardApiKeys(raw: unknown): JobBoardApiKeys {
  const result = JobBoardApiKeysSchema.safeParse(raw)
  return result.success ? result.data : {}
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/job-hunt/board-sources/schema.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/job-hunt/board-sources/schema.ts src/modules/job-hunt/board-sources/schema.test.ts
git commit -m "feat(job-board-sources): add Zod schemas for board sources and search criteria"
```

---

## Task 3: Remotive adapter

**Files:**
- Create: `src/modules/job-hunt/board-adapters/remotive.ts`
- Create: `src/modules/job-hunt/board-adapters/remotive.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/job-hunt/board-adapters/remotive.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchJobs, isAvailable } from './remotive'
import type { JobHuntSearchCriteria } from '../board-sources/schema'

const criteria: JobHuntSearchCriteria = {
  roles: ['Engineering Manager'],
  locations: ['Remote'],
  datePosted: 'last30',
  minSalary: null,
}

beforeEach(() => mockFetch.mockReset())

describe('isAvailable', () => {
  it('returns true — no auth required', () => {
    expect(isAvailable()).toBe(true)
  })
})

describe('fetchJobs (Remotive)', () => {
  it('maps response to BoardJobListing shape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          {
            id: 42,
            url: 'https://remotive.com/job/42',
            title: 'Engineering Manager',
            company_name: 'Acme',
            candidate_required_location: 'Worldwide',
            salary: '$180,000',
            publication_date: '2026-06-01T10:00:00Z',
          },
        ],
      }),
    })
    const jobs = await fetchJobs(criteria)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      externalId: '42',
      title: 'Engineering Manager',
      company: 'Acme',
      location: 'Worldwide',
      url: 'https://remotive.com/job/42',
      salary: '$180,000',
    })
    expect(jobs[0].postedAt).toBeInstanceOf(Date)
  })

  it('returns empty array for empty salary string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          {
            id: 1,
            url: 'https://remotive.com/job/1',
            title: 'Engineer',
            company_name: 'Co',
            candidate_required_location: 'Remote',
            salary: '',
            publication_date: null,
          },
        ],
      }),
    })
    const jobs = await fetchJobs(criteria)
    expect(jobs[0].salary).toBeNull()
    expect(jobs[0].postedAt).toBeNull()
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(fetchJobs(criteria)).rejects.toThrow('Remotive returned 503')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/job-hunt/board-adapters/remotive.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Write the adapter**

```ts
// src/modules/job-hunt/board-adapters/remotive.ts
import type { BoardJobListing, JobHuntSearchCriteria } from '../board-sources/schema'

export function isAvailable(): boolean {
  return true
}

export async function fetchJobs(criteria: JobHuntSearchCriteria): Promise<BoardJobListing[]> {
  const query = criteria.roles.join(',')
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=50`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Remotive returned ${res.status}`)
  const data = (await res.json()) as { jobs: unknown[] }
  return (data.jobs ?? []).map((j) => {
    const job = j as Record<string, unknown>
    const rawSalary = typeof job.salary === 'string' ? job.salary.trim() : null
    const rawDate = typeof job.publication_date === 'string' ? job.publication_date : null
    const parsed = rawDate ? new Date(rawDate) : null
    return {
      externalId: String(job.id ?? ''),
      title: String(job.title ?? ''),
      company: String(job.company_name ?? ''),
      location: typeof job.candidate_required_location === 'string'
        ? job.candidate_required_location || null
        : null,
      url: String(job.url ?? ''),
      postedAt: parsed && !isNaN(parsed.getTime()) ? parsed : null,
      salary: rawSalary || null,
    }
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/job-hunt/board-adapters/remotive.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/job-hunt/board-adapters/remotive.ts src/modules/job-hunt/board-adapters/remotive.test.ts
git commit -m "feat(job-board-sources): add Remotive board adapter"
```

---

## Task 4: RemoteOK adapter

**Files:**
- Create: `src/modules/job-hunt/board-adapters/remoteok.ts`
- Create: `src/modules/job-hunt/board-adapters/remoteok.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/job-hunt/board-adapters/remoteok.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchJobs, isAvailable } from './remoteok'
import type { JobHuntSearchCriteria } from '../board-sources/schema'

const criteria: JobHuntSearchCriteria = {
  roles: ['Engineering Manager'],
  locations: ['Remote'],
  datePosted: 'last30',
  minSalary: null,
}

beforeEach(() => mockFetch.mockReset())

describe('isAvailable', () => {
  it('returns true', () => {
    expect(isAvailable()).toBe(true)
  })
})

describe('fetchJobs (RemoteOK)', () => {
  it('skips the first metadata element and maps jobs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { legal: 'metadata object — skip me' },
        {
          id: 'remoteok-job-1',
          url: 'https://remoteok.com/jobs/1',
          position: 'Engineering Manager',
          company: 'StartupCo',
          location: 'Worldwide',
          salary_min: 150000,
          salary_max: 200000,
          date: '2026-06-01T00:00:00Z',
        },
      ]),
    })
    const jobs = await fetchJobs(criteria)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      externalId: 'remoteok-job-1',
      title: 'Engineering Manager',
      company: 'StartupCo',
      location: 'Worldwide',
    })
    expect(jobs[0].salary).toBe('$150,000 – $200,000')
  })

  it('handles missing salary fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { legal: 'skip' },
        { id: '2', url: 'https://x.com', position: 'Dev', company: 'Co', location: '', date: null },
      ]),
    })
    const jobs = await fetchJobs(criteria)
    expect(jobs[0].salary).toBeNull()
    expect(jobs[0].location).toBeNull()
    expect(jobs[0].postedAt).toBeNull()
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })
    await expect(fetchJobs(criteria)).rejects.toThrow('RemoteOK returned 429')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/job-hunt/board-adapters/remoteok.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Write the adapter**

```ts
// src/modules/job-hunt/board-adapters/remoteok.ts
import type { BoardJobListing, JobHuntSearchCriteria } from '../board-sources/schema'

export function isAvailable(): boolean {
  return true
}

export async function fetchJobs(criteria: JobHuntSearchCriteria): Promise<BoardJobListing[]> {
  const tags = criteria.roles.map((r) => r.toLowerCase().replace(/\s+/g, '-')).join(',')
  const url = `https://remoteok.com/api?tags=${encodeURIComponent(tags)}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'currnt-job-hunt/1.0' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`RemoteOK returned ${res.status}`)
  const data = (await res.json()) as unknown[]
  // First element is a metadata object — skip it
  return data.slice(1).map((j) => {
    const job = j as Record<string, unknown>
    const salaryMin = typeof job.salary_min === 'number' ? job.salary_min : null
    const salaryMax = typeof job.salary_max === 'number' ? job.salary_max : null
    const salary = salaryMin
      ? salaryMax && salaryMax !== salaryMin
        ? `$${salaryMin.toLocaleString()} – $${salaryMax.toLocaleString()}`
        : `$${salaryMin.toLocaleString()}`
      : null
    const rawDate = typeof job.date === 'string' ? job.date : null
    const parsed = rawDate ? new Date(rawDate) : null
    const loc = typeof job.location === 'string' ? job.location.trim() : null
    return {
      externalId: String(job.id ?? ''),
      title: String(job.position ?? ''),
      company: String(job.company ?? ''),
      location: loc || null,
      url: String(job.url ?? ''),
      postedAt: parsed && !isNaN(parsed.getTime()) ? parsed : null,
      salary,
    }
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/job-hunt/board-adapters/remoteok.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/job-hunt/board-adapters/remoteok.ts src/modules/job-hunt/board-adapters/remoteok.test.ts
git commit -m "feat(job-board-sources): add RemoteOK board adapter"
```

---

## Task 5: Adzuna adapter

**Files:**
- Create: `src/modules/job-hunt/board-adapters/adzuna.ts`
- Create: `src/modules/job-hunt/board-adapters/adzuna.test.ts`

Adzuna requires `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` env vars (app-level, not user-provided). It supports country-specific endpoints — we map each location string to an ISO country code and make one request per country.

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/job-hunt/board-adapters/adzuna.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchJobs, isAvailable, locationToCountryCode } from './adzuna'
import type { JobHuntSearchCriteria } from '../board-sources/schema'

const criteria: JobHuntSearchCriteria = {
  roles: ['Engineering Manager'],
  locations: ['Ireland'],
  datePosted: 'last30',
  minSalary: 90000,
}

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubEnv('ADZUNA_APP_ID', 'test-app-id')
  vi.stubEnv('ADZUNA_APP_KEY', 'test-app-key')
})

describe('isAvailable', () => {
  it('returns true when env vars are set', () => {
    expect(isAvailable()).toBe(true)
  })

  it('returns false when env vars are missing', () => {
    vi.stubEnv('ADZUNA_APP_ID', '')
    expect(isAvailable()).toBe(false)
  })
})

describe('locationToCountryCode', () => {
  it('maps Ireland to ie', () => expect(locationToCountryCode('Ireland')).toBe('ie'))
  it('maps UK / United Kingdom to gb', () => {
    expect(locationToCountryCode('United Kingdom')).toBe('gb')
    expect(locationToCountryCode('UK')).toBe('gb')
  })
  it('maps France to fr', () => expect(locationToCountryCode('France')).toBe('fr'))
  it('maps Remote to us as fallback', () => expect(locationToCountryCode('Remote')).toBe('us'))
  it('returns us for unknown strings', () => expect(locationToCountryCode('Narnia')).toBe('us'))
})

describe('fetchJobs (Adzuna)', () => {
  it('maps results to BoardJobListing shape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'adzuna-1',
            title: 'Engineering Manager',
            company: { display_name: 'TechCorp' },
            location: { display_name: 'Dublin, Ireland' },
            created: '2026-06-01T10:00:00Z',
            salary_min: 90000,
            salary_max: 130000,
            redirect_url: 'https://adzuna.ie/jobs/details/adzuna-1',
          },
        ],
      }),
    })
    const jobs = await fetchJobs(criteria)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      externalId: 'ie-adzuna-1',
      title: 'Engineering Manager',
      company: 'TechCorp',
      location: 'Dublin, Ireland',
    })
    expect(jobs[0].salary).toBe('€90,000 – €130,000')
    expect(jobs[0].postedAt).toBeInstanceOf(Date)
  })

  it('deduplicates jobs appearing in multiple country results', async () => {
    const job = {
      id: 'shared-1',
      title: 'EM',
      company: { display_name: 'Co' },
      location: { display_name: 'Remote' },
      created: '2026-06-01T00:00:00Z',
      salary_min: null,
      salary_max: null,
      redirect_url: 'https://x.com',
    }
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [job] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [job] }) })

    const multiCriteria: JobHuntSearchCriteria = {
      ...criteria,
      locations: ['Ireland', 'United Kingdom'],
    }
    const jobs = await fetchJobs(multiCriteria)
    // same id from two countries → two distinct externalIds (ie-shared-1, gb-shared-1)
    expect(jobs).toHaveLength(2)
  })

  it('skips a country request that fails and continues with others', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            id: '2', title: 'EM', company: { display_name: 'Co' },
            location: { display_name: 'London' }, created: '2026-06-01T00:00:00Z',
            salary_min: null, salary_max: null, redirect_url: 'https://x.com',
          }],
        }),
      })

    const multiCriteria: JobHuntSearchCriteria = {
      ...criteria,
      locations: ['Ireland', 'United Kingdom'],
    }
    const jobs = await fetchJobs(multiCriteria)
    expect(jobs).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/job-hunt/board-adapters/adzuna.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Write the adapter**

```ts
// src/modules/job-hunt/board-adapters/adzuna.ts
import type { BoardJobListing, JobHuntSearchCriteria } from '../board-sources/schema'

const COUNTRY_MAP: Record<string, string> = {
  ireland: 'ie',
  'united kingdom': 'gb',
  uk: 'gb',
  france: 'fr',
  'united states': 'us',
  usa: 'us',
  canada: 'ca',
  australia: 'au',
  germany: 'de',
  netherlands: 'nl',
}

export function locationToCountryCode(location: string): string {
  const key = location.toLowerCase().trim()
  return COUNTRY_MAP[key] ?? 'us'
}

export function isAvailable(): boolean {
  return !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)
}

function datePostedToDays(datePosted: JobHuntSearchCriteria['datePosted']): number | null {
  if (datePosted === 'last7') return 7
  if (datePosted === 'last30') return 30
  if (datePosted === 'last90') return 90
  return null
}

async function fetchForCountry(
  countryCode: string,
  role: string,
  criteria: JobHuntSearchCriteria,
): Promise<Array<{ countryCode: string; raw: Record<string, unknown> }>> {
  const appId = process.env.ADZUNA_APP_ID!
  const appKey = process.env.ADZUNA_APP_KEY!
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: '50',
    what: role,
    content_type: 'application/json',
  })
  const days = datePostedToDays(criteria.datePosted)
  if (days) params.set('max_days_old', String(days))
  if (criteria.minSalary) params.set('salary_min', String(criteria.minSalary))

  const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?${params}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Adzuna ${countryCode} returned ${res.status}`)
  const data = (await res.json()) as { results: unknown[] }
  return (data.results ?? []).map((r) => ({
    countryCode,
    raw: r as Record<string, unknown>,
  }))
}

function formatSalary(min: number | null, max: number | null, countryCode: string): string | null {
  if (!min) return null
  const symbol = countryCode === 'ie' || countryCode === 'fr' ? '€' : '£'
  if (max && max !== min) {
    return `${symbol}${min.toLocaleString()} – ${symbol}${max.toLocaleString()}`
  }
  return `${symbol}${min.toLocaleString()}`
}

export async function fetchJobs(criteria: JobHuntSearchCriteria): Promise<BoardJobListing[]> {
  // Derive unique country codes from location list; fall back to 'us' if empty
  const locations = criteria.locations.length ? criteria.locations : ['Remote']
  const countryCodes = [...new Set(locations.map(locationToCountryCode))]

  const results: BoardJobListing[] = []

  for (const role of criteria.roles) {
    const settled = await Promise.allSettled(
      countryCodes.map((cc) => fetchForCountry(cc, role, criteria)),
    )
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i]
      if (result.status === 'rejected') continue
      const cc = countryCodes[i]
      for (const { raw } of result.value) {
        const company = (raw.company as Record<string, unknown> | undefined)?.display_name
        const location = (raw.location as Record<string, unknown> | undefined)?.display_name
        const rawDate = typeof raw.created === 'string' ? raw.created : null
        const parsed = rawDate ? new Date(rawDate) : null
        const salaryMin = typeof raw.salary_min === 'number' ? raw.salary_min : null
        const salaryMax = typeof raw.salary_max === 'number' ? raw.salary_max : null
        results.push({
          externalId: `${cc}-${String(raw.id ?? '')}`,
          title: String(raw.title ?? ''),
          company: typeof company === 'string' ? company : '',
          location: typeof location === 'string' ? location : null,
          url: typeof raw.redirect_url === 'string' ? raw.redirect_url : '',
          postedAt: parsed && !isNaN(parsed.getTime()) ? parsed : null,
          salary: formatSalary(salaryMin, salaryMax, cc),
        })
      }
    }
  }

  return results
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/job-hunt/board-adapters/adzuna.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/job-hunt/board-adapters/adzuna.ts src/modules/job-hunt/board-adapters/adzuna.test.ts
git commit -m "feat(job-board-sources): add Adzuna board adapter with country mapping"
```

---

## Task 6: JSearch adapter

**Files:**
- Create: `src/modules/job-hunt/board-adapters/jsearch.ts`
- Create: `src/modules/job-hunt/board-adapters/jsearch.test.ts`

JSearch is a RapidAPI product that searches LinkedIn, Indeed, and Glassdoor. The user provides their own RapidAPI key via Settings → Job Boards. The key is passed in as a parameter (decrypted server-side before calling the adapter).

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/job-hunt/board-adapters/jsearch.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchJobs, isAvailable } from './jsearch'
import type { JobHuntSearchCriteria } from '../board-sources/schema'

const criteria: JobHuntSearchCriteria = {
  roles: ['Engineering Manager'],
  locations: ['Ireland'],
  datePosted: 'last30',
  minSalary: null,
}

beforeEach(() => mockFetch.mockReset())

describe('isAvailable', () => {
  it('returns true when apiKey is provided', () => {
    expect(isAvailable('rapidapi-key-abc')).toBe(true)
  })

  it('returns false when apiKey is null', () => {
    expect(isAvailable(null)).toBe(false)
  })
})

describe('fetchJobs (JSearch)', () => {
  it('maps results to BoardJobListing shape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            job_id: 'jsearch-abc-123',
            job_title: 'Engineering Manager',
            employer_name: 'GlobalCorp',
            job_city: 'Dublin',
            job_country: 'Ireland',
            job_apply_link: 'https://linkedin.com/jobs/view/123',
            job_posted_at_datetime_utc: '2026-06-01T09:00:00Z',
            job_min_salary: 100000,
            job_max_salary: 140000,
          },
        ],
      }),
    })
    const jobs = await fetchJobs(criteria, 'test-key')
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      externalId: 'jsearch-abc-123',
      title: 'Engineering Manager',
      company: 'GlobalCorp',
      url: 'https://linkedin.com/jobs/view/123',
    })
    expect(jobs[0].postedAt).toBeInstanceOf(Date)
    expect(jobs[0].salary).toMatch(/100,000/)
  })

  it('handles missing salary and city', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{
          job_id: '1', job_title: 'Dev', employer_name: 'Co',
          job_city: null, job_country: 'Remote',
          job_apply_link: 'https://x.com', job_posted_at_datetime_utc: null,
          job_min_salary: null, job_max_salary: null,
        }],
      }),
    })
    const jobs = await fetchJobs(criteria, 'test-key')
    expect(jobs[0].salary).toBeNull()
    expect(jobs[0].location).toBe('Remote')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(fetchJobs(criteria, 'bad-key')).rejects.toThrow('JSearch returned 401')
  })

  it('makes separate requests per role', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    await fetchJobs({ ...criteria, roles: ['EM', 'PM'] }, 'test-key')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/job-hunt/board-adapters/jsearch.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Write the adapter**

```ts
// src/modules/job-hunt/board-adapters/jsearch.ts
import type { BoardJobListing, JobHuntSearchCriteria } from '../board-sources/schema'

export function isAvailable(apiKey: string | null): boolean {
  return !!apiKey
}

function datePostedToFilter(datePosted: JobHuntSearchCriteria['datePosted']): string {
  if (datePosted === 'last7') return 'week'
  if (datePosted === 'last30') return 'month'
  if (datePosted === 'last90') return 'month'
  return 'all'
}

async function fetchForQuery(
  query: string,
  apiKey: string,
  dateFilter: string,
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ query, date_posted: dateFilter, num_pages: '1' })
  const res = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`JSearch returned ${res.status}`)
  const data = (await res.json()) as { data: unknown[] }
  return (data.data ?? []) as Record<string, unknown>[]
}

export async function fetchJobs(
  criteria: JobHuntSearchCriteria,
  apiKey: string,
): Promise<BoardJobListing[]> {
  const locations = criteria.locations.length ? criteria.locations : ['']
  const dateFilter = datePostedToFilter(criteria.datePosted)

  // Build one query per role, appending the first location (JSearch handles geo natively)
  const queries = criteria.roles.map((role) =>
    locations[0] ? `${role} in ${locations[0]}` : role,
  )

  const results: BoardJobListing[] = []
  const settled = await Promise.allSettled(
    queries.map((q) => fetchForQuery(q, apiKey, dateFilter)),
  )
  for (const result of settled) {
    if (result.status === 'rejected') continue
    for (const raw of result.value) {
      const city = typeof raw.job_city === 'string' ? raw.job_city : null
      const country = typeof raw.job_country === 'string' ? raw.job_country : null
      const location = [city, country].filter(Boolean).join(', ') || null
      const rawDate = typeof raw.job_posted_at_datetime_utc === 'string'
        ? raw.job_posted_at_datetime_utc
        : null
      const parsed = rawDate ? new Date(rawDate) : null
      const salMin = typeof raw.job_min_salary === 'number' ? raw.job_min_salary : null
      const salMax = typeof raw.job_max_salary === 'number' ? raw.job_max_salary : null
      const salary = salMin
        ? salMax && salMax !== salMin
          ? `$${salMin.toLocaleString()} – $${salMax.toLocaleString()}`
          : `$${salMin.toLocaleString()}`
        : null
      results.push({
        externalId: String(raw.job_id ?? ''),
        title: String(raw.job_title ?? ''),
        company: String(raw.employer_name ?? ''),
        location,
        url: typeof raw.job_apply_link === 'string' ? raw.job_apply_link : '',
        postedAt: parsed && !isNaN(parsed.getTime()) ? parsed : null,
        salary,
      })
    }
  }
  return results
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/job-hunt/board-adapters/jsearch.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/job-hunt/board-adapters/jsearch.ts src/modules/job-hunt/board-adapters/jsearch.test.ts
git commit -m "feat(job-board-sources): add JSearch (RapidAPI) board adapter"
```

---

## Task 7: Board adapter index

**Files:**
- Create: `src/modules/job-hunt/board-adapters/index.ts`

- [ ] **Step 1: Write the dispatch index**

```ts
// src/modules/job-hunt/board-adapters/index.ts
import type { BoardJobListing, JobHuntSearchCriteria } from '../board-sources/schema'
import * as remotive from './remotive'
import * as remoteok from './remoteok'
import * as adzuna from './adzuna'
import * as jsearch from './jsearch'

export type BoardAdapter = {
  isAvailable(apiKey?: string | null): boolean
  fetchJobs(criteria: JobHuntSearchCriteria, apiKey?: string | null): Promise<BoardJobListing[]>
}

const ADAPTERS: Record<string, BoardAdapter> = {
  remotive: {
    isAvailable: () => remotive.isAvailable(),
    fetchJobs: (c) => remotive.fetchJobs(c),
  },
  remoteok: {
    isAvailable: () => remoteok.isAvailable(),
    fetchJobs: (c) => remoteok.fetchJobs(c),
  },
  adzuna: {
    isAvailable: () => adzuna.isAvailable(),
    fetchJobs: (c) => adzuna.fetchJobs(c),
  },
  jsearch: {
    isAvailable: (apiKey) => jsearch.isAvailable(apiKey ?? null),
    fetchJobs: (c, apiKey) => jsearch.fetchJobs(c, apiKey ?? ''),
  },
}

export function getBoardAdapter(provider: string): BoardAdapter | null {
  return ADAPTERS[provider] ?? null
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/job-hunt/board-adapters/index.ts
git commit -m "feat(job-board-sources): add board adapter dispatch index"
```

---

## Task 8: Board sources queries

**Files:**
- Create: `src/modules/job-hunt/board-sources/queries.ts`

- [ ] **Step 1: Write the queries module**

```ts
// src/modules/job-hunt/board-sources/queries.ts
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { BOARD_PROVIDERS } from './schema'

export async function ensureBoardSources(profileId: string): Promise<void> {
  await Promise.all(
    BOARD_PROVIDERS.map((provider) =>
      prisma.jobBoardSource.upsert({
        where: { profileId_provider: { profileId, provider } },
        create: { profileId, provider, enabled: true },
        update: {},
      }),
    ),
  )
}

export async function getBoardSources() {
  const { profile } = await requireProfile()
  await ensureBoardSources(profile.id)
  return prisma.jobBoardSource.findMany({
    where: { profileId: profile.id },
    orderBy: { provider: 'asc' },
  })
}

export async function getJobHuntSearch() {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { jobHuntSearch: true, onboardingContext: true },
  })
  return { jobHuntSearch: settings?.jobHuntSearch ?? null, onboardingContext: settings?.onboardingContext ?? null }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/job-hunt/board-sources/queries.ts
git commit -m "feat(job-board-sources): add board sources queries"
```

---

## Task 9: Board sources actions

**Files:**
- Create: `src/modules/job-hunt/board-sources/actions.ts`
- Create: `src/modules/job-hunt/board-sources/actions.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/job-hunt/board-sources/actions.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Write the actions module**

```ts
// src/modules/job-hunt/board-sources/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { decrypt } from '@/lib/encryption'
import {
  JobHuntSearchCriteriaSchema,
  normalizeJobBoardApiKeys,
  type JobHuntSearchCriteria,
} from './schema'
import { getBoardAdapter } from '../board-adapters/index'
import { normalizeJobHuntSearch } from './schema'
import type { ScanResult } from '../schema'

// ── toggleBoardSource ─────────────────────────────────────────────────────────

type ToggleResult = { ok: true } | { ok: false; error: 'not_found' }

export async function toggleBoardSource(sourceId: string): Promise<ToggleResult> {
  const { profile } = await requireProfile()
  const source = await prisma.jobBoardSource.findFirst({
    where: { id: sourceId, profileId: profile.id },
  })
  if (!source) return { ok: false, error: 'not_found' }
  await prisma.jobBoardSource.update({
    where: { id: sourceId },
    data: { enabled: !source.enabled },
  })
  revalidatePath('/dashboard/job-hunt')
  return { ok: true }
}

// ── saveJobHuntSearch ─────────────────────────────────────────────────────────

export async function saveJobHuntSearch(criteria: JobHuntSearchCriteria): Promise<void> {
  const parsed = JobHuntSearchCriteriaSchema.safeParse(criteria)
  if (!parsed.success) return
  const { profile } = await requireProfile()
  await prisma.userSettings.upsert({
    where: { profileId: profile.id },
    create: { profileId: profile.id, jobHuntSearch: parsed.data },
    update: { jobHuntSearch: parsed.data },
  })
  revalidatePath('/dashboard/job-hunt')
}

// ── scanBoardSource ───────────────────────────────────────────────────────────

export async function scanBoardSource(sourceId: string): Promise<ScanResult> {
  const { profile } = await requireProfile()

  const [source, settings] = await Promise.all([
    prisma.jobBoardSource.findFirst({
      where: { id: sourceId, profileId: profile.id, enabled: true },
    }),
    prisma.userSettings.findUnique({
      where: { profileId: profile.id },
      select: { jobHuntSearch: true, jobBoardApiKeys: true },
    }),
  ])

  if (!source) return { ok: false, error: 'not_found' }

  const adapter = getBoardAdapter(source.provider)
  if (!adapter) return { ok: false, error: 'no_ats_detected' }

  const apiKeys = normalizeJobBoardApiKeys(settings?.jobBoardApiKeys)
  const rawJSearchKey = apiKeys.jsearch ?? null
  const jSearchKey = rawJSearchKey ? (() => { try { return decrypt(rawJSearchKey) } catch { return null } })() : null
  const apiKey = source.provider === 'jsearch' ? jSearchKey : null

  if (!adapter.isAvailable(apiKey)) return { ok: false, error: 'no_ats_detected' }

  const criteria = normalizeJobHuntSearch(settings?.jobHuntSearch)

  let listings
  try {
    listings = await adapter.fetchJobs(criteria, apiKey)
  } catch {
    return { ok: false, error: 'fetch_failed' }
  }

  const existing = await prisma.discoveredJob.findMany({
    where: { boardSourceId: sourceId },
    select: { externalId: true },
  })
  const existingIds = new Set(existing.map((e) => e.externalId))
  const newListings = listings.filter((j) => !existingIds.has(j.externalId))

  if (newListings.length > 0) {
    await prisma.discoveredJob.createMany({
      data: newListings.map((j) => ({
        boardSourceId: sourceId,
        profileId: profile.id,
        externalId: j.externalId,
        title: j.title,
        company: j.company,
        location: j.location,
        salary: j.salary,
        url: j.url,
        postedAt: j.postedAt,
        status: 'new',
      })),
    })
  }

  await prisma.jobBoardSource.update({
    where: { id: sourceId },
    data: { lastScannedAt: new Date() },
  })

  revalidatePath('/dashboard/job-hunt')
  return {
    ok: true,
    found: listings.length,
    matched: listings.length,
    newJobs: newListings.length,
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/job-hunt/board-sources/actions.test.ts
```

Expected: all pass.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/job-hunt/board-sources/actions.ts src/modules/job-hunt/board-sources/actions.test.ts
git commit -m "feat(job-board-sources): add board source server actions"
```

---

## Task 10: Update job-hunt queries for nullable watchId

**Files:**
- Modify: `src/modules/job-hunt/queries.ts`

The existing `getDiscoveredJobs` filters via `watch: { status: { not: 'paused' } }` which will silently drop board-source jobs (they have no watch). Update it to include both source types.

- [ ] **Step 1: Replace `queries.ts`**

```ts
// src/modules/job-hunt/queries.ts
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'

export async function getWatchlist() {
  const { profile } = await requireProfile()
  return prisma.companyWatch.findMany({
    where: { profileId: profile.id, status: { not: 'paused' } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getDiscoveredJobs(filters?: {
  watchIds?: string[]
  boardSourceIds?: string[]
  statuses?: string[]
  sourceType?: 'company' | 'board'
}) {
  const { profile } = await requireProfile()

  return prisma.discoveredJob.findMany({
    where: {
      profileId: profile.id,
      status: filters?.statuses ? { in: filters.statuses } : { notIn: ['ignored'] },
      // Only include company-watch jobs from active watches
      ...(filters?.sourceType === 'company'
        ? { watchId: { not: null }, boardSourceId: null }
        : filters?.sourceType === 'board'
          ? { boardSourceId: { not: null }, watchId: null }
          : {}),
      ...(filters?.watchIds?.length ? { watchId: { in: filters.watchIds } } : {}),
      ...(filters?.boardSourceIds?.length
        ? { boardSourceId: { in: filters.boardSourceIds } }
        : {}),
    },
    include: {
      watch: { select: { name: true, atsProvider: true, status: true } },
      boardSource: { select: { provider: true } },
    },
    orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getDiscoveredJob(id: string) {
  const { profile } = await requireProfile()
  return prisma.discoveredJob.findFirst({
    where: { id, profileId: profile.id },
  })
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors. (Some component files may now have type mismatches on `watch` — those are fixed in Task 16.)

- [ ] **Step 3: Commit**

```bash
git add src/modules/job-hunt/queries.ts
git commit -m "feat(job-board-sources): update getDiscoveredJobs for nullable watchId and board source include"
```

---

## Task 11: Extend `scanAll` to cover board sources

**Files:**
- Modify: `src/modules/job-hunt/actions.ts`

Find the `scanAll` export. It currently only iterates over `CompanyWatch` rows. Extend it to also scan enabled `JobBoardSource` rows and return merged totals.

- [ ] **Step 1: Import the board source scan action**

At the top of `src/modules/job-hunt/actions.ts`, add this import after the existing imports:

```ts
import { scanBoardSource } from './board-sources/actions'
```

- [ ] **Step 2: Replace the `scanAll` function**

Find and replace the existing `export async function scanAll()` with:

```ts
export async function scanAll(): Promise<
  { ok: true; scanned: number; newJobs: number; failed: number } | { ok: false; error: string }
> {
  const { profile } = await requireProfile()

  const [watches, boardSources] = await Promise.all([
    prisma.companyWatch.findMany({
      where: { profileId: profile.id, status: 'active', boardSlug: { not: null } },
      select: { id: true },
    }),
    prisma.jobBoardSource.findMany({
      where: { profileId: profile.id, enabled: true },
      select: { id: true },
    }),
  ])

  let scanned = 0
  let newJobs = 0
  let failed = 0

  const companyResults = await Promise.allSettled(
    watches.map((w) => scanCompany(w.id)),
  )
  for (const r of companyResults) {
    if (r.status === 'rejected' || !r.value.ok) { failed++; continue }
    scanned++
    newJobs += r.value.newJobs
  }

  const boardResults = await Promise.allSettled(
    boardSources.map((s) => scanBoardSource(s.id)),
  )
  for (const r of boardResults) {
    if (r.status === 'rejected' || !r.value.ok) { failed++; continue }
    scanned++
    newJobs += r.value.newJobs
  }

  revalidatePath('/dashboard/job-hunt')
  return { ok: true, scanned, newJobs, failed }
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/job-hunt/actions.ts
git commit -m "feat(job-board-sources): extend scanAll to include board sources"
```

---

## Task 12: Settings — Job Boards page

**Files:**
- Create: `src/app/dashboard/settings/job-boards/page.tsx`
- Create: `src/app/dashboard/settings/job-boards/_components/job-boards-form.tsx`

This page follows the same structure as the LLM settings page. It has two sections: Adzuna (status only, app-level keys) and JSearch (user-provided RapidAPI key, encrypted at rest).

- [ ] **Step 1: Write the form component**

```tsx
// src/app/dashboard/settings/job-boards/_components/job-boards-form.tsx
'use client'

import { useState, useTransition } from 'react'
import { Check, Eye, EyeOff, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { saveJobBoardApiKey, clearJobBoardApiKey } from '../_actions'

type Props = {
  adzunaConfigured: boolean
  jSearchConfigured: boolean
}

export function JobBoardsForm({ adzunaConfigured, jSearchConfigured }: Props) {
  const [jSearchKey, setJSearchKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keyConfigured, setKeyConfigured] = useState(jSearchConfigured)
  const [saving, startSave] = useTransition()
  const [clearing, startClear] = useTransition()

  function handleSave() {
    if (!jSearchKey.trim()) return
    startSave(async () => {
      try {
        await saveJobBoardApiKey('jsearch', jSearchKey.trim())
        setKeyConfigured(true)
        setJSearchKey('')
        toast.success('JSearch API key saved')
      } catch {
        toast.error('Failed to save key')
      }
    })
  }

  function handleClear() {
    if (!confirm('Remove the JSearch API key? Board scanning via LinkedIn/Indeed/Glassdoor will stop.')) return
    startClear(async () => {
      try {
        await clearJobBoardApiKey('jsearch')
        setKeyConfigured(false)
        toast.success('API key removed')
      } catch {
        toast.error('Failed to remove key')
      }
    })
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Adzuna */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Adzuna</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Broad global coverage — aggregates IE, UK, FR, US job boards. App-level key, no action required.
            </p>
          </div>
          {adzunaConfigured ? (
            <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-300">
              <Check size={11} /> Configured
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Not available
            </Badge>
          )}
        </div>
      </div>

      <div className="border-t" />

      {/* JSearch */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">JSearch (RapidAPI)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Searches LinkedIn, Indeed, and Glassdoor globally. Requires your own RapidAPI key — free tier available.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="jsearch-key">RapidAPI Key</Label>
            {keyConfigured && (
              <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-300">
                <Check size={11} /> Saved
              </Badge>
            )}
          </div>
          <div className="flex rounded-md border overflow-hidden">
            <Input
              id="jsearch-key"
              type={showKey ? 'text' : 'password'}
              value={jSearchKey}
              onChange={(e) => setJSearchKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={keyConfigured ? '•••••••• (leave blank to keep existing)' : 'Your RapidAPI key…'}
              autoComplete="off"
              disabled={saving}
              className="border-0 rounded-none flex-1 font-mono focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !jSearchKey.trim()}
              aria-label="Save key"
              className="px-3 border-l bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide key' : 'Show key'}
              className="px-3 border-l bg-muted text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Encrypted at rest (AES-256-GCM).</p>
        </div>

        {keyConfigured && (
          <div className="border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              disabled={clearing}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
            >
              <Trash2 size={14} />
              Remove API key
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the settings actions file**

```ts
// src/app/dashboard/settings/job-boards/_actions.ts
'use server'

import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { encrypt, decrypt } from '@/lib/encryption'
import { normalizeJobBoardApiKeys } from '@/modules/job-hunt/board-sources/schema'
import { Prisma } from '@prisma/client'

export async function saveJobBoardApiKey(provider: 'jsearch', rawKey: string): Promise<void> {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { jobBoardApiKeys: true },
  })
  const current = normalizeJobBoardApiKeys(settings?.jobBoardApiKeys)
  const updated = { ...current, [provider]: encrypt(rawKey) }
  await prisma.userSettings.upsert({
    where: { profileId: profile.id },
    create: { profileId: profile.id, jobBoardApiKeys: updated },
    update: { jobBoardApiKeys: updated },
  })
}

export async function clearJobBoardApiKey(provider: 'jsearch'): Promise<void> {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { jobBoardApiKeys: true },
  })
  const current = normalizeJobBoardApiKeys(settings?.jobBoardApiKeys)
  const { [provider]: _removed, ...rest } = current
  await prisma.userSettings.update({
    where: { profileId: profile.id },
    data: { jobBoardApiKeys: Object.keys(rest).length ? rest : Prisma.JsonNull },
  })
}

export async function getJobBoardKeyStatus(): Promise<{
  adzunaConfigured: boolean
  jSearchConfigured: boolean
}> {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { jobBoardApiKeys: true },
  })
  const keys = normalizeJobBoardApiKeys(settings?.jobBoardApiKeys)
  let jSearchOk = false
  if (keys.jsearch) {
    try { decrypt(keys.jsearch); jSearchOk = true } catch { /* corrupt */ }
  }
  return {
    adzunaConfigured: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    jSearchConfigured: jSearchOk,
  }
}
```

- [ ] **Step 3: Write the page**

```tsx
// src/app/dashboard/settings/job-boards/page.tsx
import { ContentContainer } from '@/app/components/ContentContainer'
import { getJobBoardKeyStatus } from './_actions'
import { JobBoardsForm } from './_components/job-boards-form'

export default async function JobBoardsSettingsPage() {
  const { adzunaConfigured, jSearchConfigured } = await getJobBoardKeyStatus()
  return (
    <ContentContainer title="Job Board Sources" description="Configure API keys for paid job board integrations.">
      <JobBoardsForm adzunaConfigured={adzunaConfigured} jSearchConfigured={jSearchConfigured} />
    </ContentContainer>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/settings/job-boards/
git commit -m "feat(job-board-sources): add Job Boards settings page with JSearch API key management"
```

---

## Task 13: Add Job Boards link to settings index

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Open `src/app/dashboard/settings/page.tsx` and add a link**

Find the existing settings link list (likely a grid of cards or list items for Account, LLM, API Tokens, etc.). Add a new entry:

```tsx
<Link href="/dashboard/settings/job-boards">
  Job Board Sources
</Link>
```

Match the exact markup pattern of the existing links in that file. Do not change anything else.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "feat(job-board-sources): add Job Boards link to settings index"
```

---

## Task 14: Search criteria bar component

**Files:**
- Create: `src/app/dashboard/job-hunt/_components/search-criteria-bar.tsx`

Reuses the existing `RoleAliasesInput` and `LocationTagsInput` components already in the job-hunt components directory.

- [ ] **Step 1: Write the component**

```tsx
// src/app/dashboard/job-hunt/_components/search-criteria-bar.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RoleAliasesInput } from './role-aliases-input'
import { LocationTagsInput } from './location-tags-input'
import { saveJobHuntSearch } from '@/modules/job-hunt/board-sources/actions'
import type { JobHuntSearchCriteria, DatePosted } from '@/modules/job-hunt/board-sources/schema'

type Props = {
  initial: JobHuntSearchCriteria
}

const DATE_OPTIONS: { value: DatePosted; label: string }[] = [
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'last90', label: 'Last 90 days' },
  { value: 'any', label: 'Any time' },
]

export function SearchCriteriaBar({ initial }: Props) {
  const [roles, setRoles] = useState<string[]>(initial.roles)
  const [locations, setLocations] = useState<string[]>(initial.locations)
  const [datePosted, setDatePosted] = useState<DatePosted>(initial.datePosted)
  const [minSalary, setMinSalary] = useState<string>(
    initial.minSalary != null ? String(initial.minSalary) : '',
  )
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleApply() {
    startTransition(async () => {
      const salaryNum = minSalary.trim() ? Number(minSalary.replace(/[^0-9]/g, '')) : null
      await saveJobHuntSearch({
        roles,
        locations,
        datePosted,
        minSalary: salaryNum && !isNaN(salaryNum) ? salaryNum : null,
      })
      toast.success('Search criteria saved')
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border bg-card px-4 py-3 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1.2fr_0.8fr_0.8fr_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Roles</Label>
          <RoleAliasesInput
            value={roles}
            onChange={setRoles}
            placeholder="+ add role…"
          />
          <p className="text-[10px] text-muted-foreground">Auto-seeded from profile · editable</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Locations</Label>
          <LocationTagsInput
            value={locations}
            onChange={setLocations}
            placeholder="+ add location…"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Date Posted</Label>
          <Select value={datePosted} onValueChange={(v) => setDatePosted(v as DatePosted)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Min. Salary</Label>
          <div className="relative">
            <Input
              value={minSalary}
              onChange={(e) => setMinSalary(e.target.value)}
              placeholder="Any"
              className="h-9 pr-5 text-sm"
            />
            {minSalary && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                +
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Where disclosed</p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleApply}
          disabled={isPending}
          className="h-9 self-start mt-6"
        >
          Apply
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/job-hunt/_components/search-criteria-bar.tsx
git commit -m "feat(job-board-sources): add universal SearchCriteriaBar component"
```

---

## Task 15: Job Board Sources column UI

**Files:**
- Create: `src/app/dashboard/job-hunt/_components/board-source-row.tsx`
- Create: `src/app/dashboard/job-hunt/_components/manual-sources-tile.tsx`
- Create: `src/app/dashboard/job-hunt/_components/job-board-sources.tsx`

- [ ] **Step 1: Write `board-source-row.tsx`**

```tsx
// src/app/dashboard/job-hunt/_components/board-source-row.tsx
'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toggleBoardSource, scanBoardSource } from '@/modules/job-hunt/board-sources/actions'
import type { JobBoardSource } from '@prisma/client'

const PROVIDER_META: Record<string, { label: string; description: string }> = {
  remotive:  { label: 'Remotive',  description: 'Remote tech · no auth' },
  remoteok:  { label: 'RemoteOK',  description: 'Remote jobs · no auth' },
  adzuna:    { label: 'Adzuna',    description: 'Global broad coverage' },
  jsearch:   { label: 'JSearch',   description: 'LinkedIn · Indeed · Glassdoor' },
}

export function BoardSourceRow({
  source,
  isAdapterAvailable,
}: {
  source: JobBoardSource
  isAdapterAvailable: boolean
}) {
  const [isToggling, startToggle] = useTransition()
  const [isScanning, startScan] = useTransition()
  const router = useRouter()
  const meta = PROVIDER_META[source.provider] ?? { label: source.provider, description: '' }

  function handleToggle() {
    startToggle(async () => {
      await toggleBoardSource(source.id)
      router.refresh()
    })
  }

  function handleScan() {
    startScan(async () => {
      const result = await scanBoardSource(source.id)
      if (!result.ok) {
        const messages: Record<string, string> = {
          not_found: 'Source not found',
          no_ats_detected: source.provider === 'jsearch'
            ? 'JSearch API key not configured — add it in Settings → Job Boards'
            : 'Source not available — check app configuration',
          fetch_failed: 'Could not reach job board. Try again later.',
        }
        toast.error(messages[result.error] ?? 'Scan failed')
        return
      }
      toast.success(
        result.newJobs > 0
          ? `Found ${result.newJobs} new role${result.newJobs === 1 ? '' : 's'}`
          : 'No new roles found',
      )
      router.refresh()
    })
  }

  const canScan = source.enabled && isAdapterAvailable

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{meta.label}</p>
        <p className="text-xs text-muted-foreground">{meta.description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {canScan && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleScan}
            disabled={isScanning}
            className="h-7 px-2 text-xs"
          >
            {isScanning
              ? <Loader2 className="size-3 animate-spin" />
              : <RefreshCw className="size-3" />}
            <span className="ml-1">{isScanning ? 'Scanning…' : 'Scan'}</span>
          </Button>
        )}
        {!isAdapterAvailable && source.provider === 'jsearch' && (
          <a
            href="/dashboard/settings/job-boards"
            className="text-xs text-primary hover:underline whitespace-nowrap"
          >
            Configure →
          </a>
        )}
        <Switch
          checked={source.enabled}
          onCheckedChange={handleToggle}
          disabled={isToggling}
          aria-label={`Toggle ${meta.label}`}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `manual-sources-tile.tsx`**

```tsx
// src/app/dashboard/job-hunt/_components/manual-sources-tile.tsx
import { ExternalLink } from 'lucide-react'

const MANUAL_SOURCES = [
  {
    vertical: 'Gaming',
    boards: [
      { label: 'Hitmarker', url: 'https://hitmarker.net/jobs' },
      { label: 'GamesJobsDirect', url: 'https://www.gamesjobsdirect.com' },
      { label: 'Work With Indies', url: 'https://www.workwithindies.com' },
    ],
  },
  {
    vertical: 'Comms / PR',
    boards: [
      { label: 'PR Week Jobs', url: 'https://jobs.prweek.com' },
      { label: 'Marketing Week', url: 'https://jobs.marketingweek.com' },
      { label: 'The Drum Jobs', url: 'https://www.thedrum.com/jobs' },
    ],
  },
  {
    vertical: 'Ireland',
    boards: [
      { label: 'IrishJobs.ie', url: 'https://www.irishjobs.ie' },
      { label: 'Jobs.ie', url: 'https://www.jobs.ie' },
      { label: 'PublicJobs.ie', url: 'https://www.publicjobs.ie' },
    ],
  },
  {
    vertical: 'Executive',
    boards: [
      { label: 'Exec Appointments', url: 'https://www.exec-appointments.com' },
      { label: 'Odgers Berndtson', url: 'https://www.odgersberndtson.com/en/careers' },
    ],
  },
]

export function ManualSourcesTile() {
  return (
    <div className="rounded-lg border border-dashed px-3 py-3 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Manual — use bookmarklet
      </p>
      {MANUAL_SOURCES.map((group) => (
        <div key={group.vertical}>
          <p className="text-[10px] font-medium text-muted-foreground mb-1">{group.vertical}</p>
          <div className="space-y-0.5">
            {group.boards.map((board) => (
              <a
                key={board.label}
                href={board.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-foreground hover:text-primary transition-colors"
              >
                {board.label}
                <ExternalLink className="size-2.5 opacity-50" />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write `job-board-sources.tsx`**

```tsx
// src/app/dashboard/job-hunt/_components/job-board-sources.tsx
import type { JobBoardSource } from '@prisma/client'
import { BoardSourceRow } from './board-source-row'
import { ManualSourcesTile } from './manual-sources-tile'

const FREE_PROVIDERS = ['remotive', 'remoteok', 'adzuna'] as const
const PAID_PROVIDERS = ['jsearch'] as const

type Props = {
  sources: JobBoardSource[]
  availableProviders: Set<string>
}

export function JobBoardSources({ sources, availableProviders }: Props) {
  const byProvider = Object.fromEntries(sources.map((s) => [s.provider, s]))

  return (
    <section>
      <h2 className="text-sm font-semibold mb-2">Job Board Sources</h2>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1">Free</p>
        {FREE_PROVIDERS.map((p) => {
          const source = byProvider[p]
          if (!source) return null
          return (
            <BoardSourceRow
              key={p}
              source={source}
              isAdapterAvailable={availableProviders.has(p)}
            />
          )
        })}

        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 pt-2">
          Paid — bring your own key
        </p>
        {PAID_PROVIDERS.map((p) => {
          const source = byProvider[p]
          if (!source) return null
          return (
            <BoardSourceRow
              key={p}
              source={source}
              isAdapterAvailable={availableProviders.has(p)}
            />
          )
        })}

        <div className="pt-2">
          <ManualSourcesTile />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/job-hunt/_components/board-source-row.tsx src/app/dashboard/job-hunt/_components/manual-sources-tile.tsx src/app/dashboard/job-hunt/_components/job-board-sources.tsx
git commit -m "feat(job-board-sources): add Job Board Sources column UI components"
```

---

## Task 16: Update Discovered Jobs UI for source pills and salary

**Files:**
- Modify: `src/app/dashboard/job-hunt/_components/job-queue-row.tsx`
- Modify: `src/app/dashboard/job-hunt/_components/discovered-jobs.tsx`

- [ ] **Step 1: Update `job-queue-row.tsx`**

The `watch` prop is now nullable and there's a new optional `boardSource`. Update the type and rendering. Find the existing type definition for the job prop and replace it:

```tsx
// Replace the existing DiscoveredJobWithWatch type and JobQueueRow component entirely:

type DiscoveredJobWithSource = {
  id: string
  title: string
  company: string
  location: string | null
  salary: string | null
  url: string | null
  postedAt: Date | null
  createdAt: Date
  fitLabel: string | null
  fitScore: number | null
  status: string
  importedJobId: string | null
  watch: { name: string; atsProvider: string; status: string } | null
  boardSource: { provider: string } | null
}
```

In the JSX, replace any references to `job.watch.name` (which would now crash on null) with `job.company` — the `company` field is always populated for all discovered jobs. Add a source pill below the company line:

```tsx
{/* Source pill — add after job.company line */}
<div className="flex items-center gap-2 mt-1">
  {job.watch && (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium">
      company
    </span>
  )}
  {job.boardSource && (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
      board
    </span>
  )}
  {job.salary && (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
      {job.salary}
    </span>
  )}
</div>
```

- [ ] **Step 2: Update `discovered-jobs.tsx`**

Add source filter tabs. Find the existing filter state (currently filters by `watchId` and `showIgnored`) and add a `sourceType` filter:

```tsx
// Add to existing state:
const [sourceType, setSourceType] = useState<'all' | 'company' | 'board' | 'scored'>('all')

// Update visible filter logic:
const visible = jobs.filter((j) => {
  if (!showIgnored && j.status === 'ignored') return false
  if (sourceType === 'company' && !j.watch) return false
  if (sourceType === 'board' && !j.boardSource) return false
  if (sourceType === 'scored' && !j.fitLabel) return false
  if (filterWatchId !== 'all' && j.watchId !== filterWatchId) return false
  return true
})
```

Add filter tabs above the job list:

```tsx
<div className="flex items-center gap-1 flex-wrap mb-2">
  {(['all', 'company', 'board', 'scored'] as const).map((t) => (
    <button
      key={t}
      onClick={() => setSourceType(t)}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        sourceType === t
          ? 'bg-primary text-primary-foreground border-primary'
          : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {t.charAt(0).toUpperCase() + t.slice(1)}
    </button>
  ))}
</div>
```

Update the `jobs` and `watches` prop types to accept the new `boardSource` field from `getDiscoveredJobs`.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/job-hunt/_components/job-queue-row.tsx src/app/dashboard/job-hunt/_components/discovered-jobs.tsx
git commit -m "feat(job-board-sources): add source pills, salary tags, and filter tabs to Discovered Jobs"
```

---

## Task 17: Redesign page to three-column layout

**Files:**
- Modify: `src/app/dashboard/job-hunt/page.tsx`

- [ ] **Step 1: Replace `page.tsx`**

```tsx
// src/app/dashboard/job-hunt/page.tsx
import { ContentContainer } from '@/app/components/ContentContainer'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { normalizeOnboardingContext } from '@/modules/onboarding/schema'
import { normalizeJobHuntSearch } from '@/modules/job-hunt/board-sources/schema'
import { getWatchlist, getDiscoveredJobs } from '@/modules/job-hunt/queries'
import { getBoardSources } from '@/modules/job-hunt/board-sources/queries'
import { getBoardAdapter } from '@/modules/job-hunt/board-adapters/index'
import { normalizeJobBoardApiKeys } from '@/modules/job-hunt/board-sources/schema'
import { decrypt } from '@/lib/encryption'
import { Watchlist } from './_components/watchlist'
import { JobBoardSources } from './_components/job-board-sources'
import { DiscoveredJobs } from './_components/discovered-jobs'
import { SearchCriteriaBar } from './_components/search-criteria-bar'
import { SyncAllButton } from './_components/sync-all-button'

export default async function JobHuntPage() {
  const { profile } = await requireProfile()

  const [watches, jobs, boardSources, settings] = await Promise.all([
    getWatchlist(),
    getDiscoveredJobs(),
    getBoardSources(),
    prisma.userSettings.findUnique({
      where: { profileId: profile.id },
      select: { onboardingContext: true, jobHuntSearch: true, jobBoardApiKeys: true },
    }),
  ])

  const { targetRole } = normalizeOnboardingContext(settings?.onboardingContext)

  // Seed roles from profile if no search criteria saved yet
  const rawSearch = normalizeJobHuntSearch(settings?.jobHuntSearch)
  const searchCriteria = rawSearch.roles.length === 0 && targetRole
    ? { ...rawSearch, roles: [targetRole] }
    : rawSearch

  // Determine which adapters are actually available (env keys + user keys)
  const apiKeys = normalizeJobBoardApiKeys(settings?.jobBoardApiKeys)
  const jSearchKey = apiKeys.jsearch
    ? (() => { try { return decrypt(apiKeys.jsearch!) } catch { return null } })()
    : null

  const availableProviders = new Set(
    boardSources
      .filter((s) => {
        const adapter = getBoardAdapter(s.provider)
        if (!adapter) return false
        const key = s.provider === 'jsearch' ? jSearchKey : null
        return adapter.isAvailable(key)
      })
      .map((s) => s.provider),
  )

  return (
    <ContentContainer title="Job Hunt">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">
          Search criteria applies across all company boards and job board sources.
        </p>
        <SyncAllButton />
      </div>

      <SearchCriteriaBar initial={searchCriteria} />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_260px_1fr] gap-4 items-start">
        <Watchlist watches={watches} />
        <JobBoardSources sources={boardSources} availableProviders={availableProviders} />
        <DiscoveredJobs jobs={jobs} watches={watches} />
      </div>
    </ContentContainer>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/job-hunt/page.tsx
git commit -m "feat(job-board-sources): redesign Job Hunt page to three-column layout with search bar"
```

---

## Task 18: Update SyncAllButton toast copy

**Files:**
- Modify: `src/app/dashboard/job-hunt/_components/sync-all-button.tsx`

- [ ] **Step 1: Update the success toast message**

Find the toast.success call in `handleSync`. Replace the message template to say "sources" instead of "companies":

```ts
// Replace the existing toast.success calls:
if (newJobs > 0) {
  toast.success(
    `Synced ${scanned} source${scanned === 1 ? '' : 's'} · ${newJobs} new role${newJobs === 1 ? '' : 's'} found${failedSuffix}`
  )
} else if (failed > 0 && failed === scanned) {
  toast.error('All syncs failed — check source configuration')
} else {
  toast.success(`Synced ${scanned} source${scanned === 1 ? '' : 's'} · no new roles${failedSuffix}`)
}
```

- [ ] **Step 2: Typecheck + full job-hunt test run**

```bash
npm run typecheck && npx vitest run src/modules/job-hunt/
```

Expected: typecheck clean, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/job-hunt/_components/sync-all-button.tsx
git commit -m "feat(job-board-sources): update SyncAllButton toast copy for multi-source"
```

---

## Final verification

- [ ] Run `npm run build` — confirm production build is clean
- [ ] Start dev server (`npm run dev`), log in, and verify:
  - Three-column layout renders at `/dashboard/job-hunt`
  - Search criteria bar shows with profile-seeded roles
  - Apply button saves criteria and refreshes
  - Remotive and RemoteOK rows show toggle on, Scan button works
  - Adzuna shows toggle off if env vars absent (or on if present)
  - JSearch shows "Configure →" link until key is set
  - Settings → Job Boards page loads, JSearch key save/clear works
  - Individual Scan on a board source creates DiscoveredJob rows
  - Sync All triggers both company and board source scans
  - Source pills (company / board) appear on discovered job rows
  - Salary tags appear where returned by board adapters
  - Filter tabs (All / Company / Boards / Scored) filter the queue correctly
  - Settings link "Job Board Sources" appears on settings index
