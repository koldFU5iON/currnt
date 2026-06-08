# Cover Letter Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a markdown-first cover letter writing desk with auto-save, job context panel, index page, and job-row menu integration.

**Architecture:** New `src/modules/cover-letters/` module (schema/queries/actions). Four new routes: index, `/new` (server create-and-redirect), workspace `[id]`, and a `_components/cover-letter-workspace.tsx` client component. Job row integration threads `coverLetterDocumentId` + `onCreateCoverLetter` through AppControls → job-row/job-row-card → job-group → job-list.

**Tech Stack:** Next.js 16 App Router, Prisma 7, Tailwind CSS v4, shadcn/ui, react-markdown + remark-gfm (already installed), vitest.

**Spec:** `docs/superpowers/specs/2026-06-07-cover-letter-workspace-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema/cover-letter.prisma` | Modify | Add `content String @default("")` |
| `src/modules/cover-letters/schema.ts` | Create | Zod types for CoverLetter |
| `src/modules/cover-letters/schema.test.ts` | Create | Schema validation tests |
| `src/modules/cover-letters/queries.ts` | Create | listCoverLetters, getCoverLetter |
| `src/modules/cover-letters/queries.test.ts` | Create | Query tests |
| `src/modules/cover-letters/actions.ts` | Create | createCoverLetter, updateCoverLetterContent, deleteCoverLetter |
| `src/modules/cover-letters/actions.test.ts` | Create | Action tests |
| `src/lib/nav-menu.ts` | Modify | Add Cover Letters nav item |
| `src/app/dashboard/cover-letters/page.tsx` | Create | Index page (server component) |
| `src/app/dashboard/cover-letters/new/page.tsx` | Create | Create-and-redirect (server component) |
| `src/app/dashboard/cover-letters/[id]/page.tsx` | Create | Workspace page (server wrapper) |
| `src/app/dashboard/cover-letters/[id]/_components/cover-letter-workspace.tsx` | Create | Full workspace client component |
| `src/app/types/job-application.ts` | Modify | Add `coverLetterDocumentId?: string \| null` to Job type |
| `src/modules/jobs/queries.ts` | Modify | Include coverLetters in getActiveJobs + getArchivedJobs |
| `src/components/app-item-menu.tsx` | Modify | Add coverLetterDocumentId + onCreateCoverLetter props + menu item |
| `src/app/dashboard/job-applications/_components/job-row.tsx` | Modify | Pass coverLetterDocumentId to AppControls |
| `src/app/dashboard/job-applications/_components/job-row-card.tsx` | Modify | Add onCreateCoverLetter prop, pass to AppControls |
| `src/app/dashboard/job-applications/_components/job-group.tsx` | Modify | Thread onCreateCoverLetter through |
| `src/app/dashboard/job-applications/_components/job-list.tsx` | Modify | Add handleCreateCoverLetter, pass to JobGroup |

---

### Task 1: Schema — add `content` to CoverLetterDocument

**Files:**
- Modify: `prisma/schema/cover-letter.prisma`

- [ ] **Step 1: Add the content field**

Open `prisma/schema/cover-letter.prisma`. After the `sections` line, add:

```prisma
model CoverLetterDocument {
  id               String   @id @default(cuid())
  profileId        String
  jobApplicationId String?
  cvDocumentId     String?
  mode             String
  jobDescription   String?
  jobTitle         String?
  company          String?
  sections         String   @default("[]")
  content          String   @default("")
  status           String   @default("draft")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  profile        Profile         @relation(fields: [profileId], references: [id], onDelete: Cascade)
  jobApplication JobApplication? @relation(fields: [jobApplicationId], references: [id])
  cvDocument     CVDocument?     @relation(fields: [cvDocumentId], references: [id])

  @@index([profileId])
}
```

- [ ] **Step 2: Create and apply the migration**

```bash
npm run db:migrate -- --name add_cover_letter_content
```

Expected: a new `prisma/migrations/<timestamp>_add_cover_letter_content/migration.sql` is created and the migration runs successfully against the local Docker DB.

- [ ] **Step 3: Verify the migration generated the right SQL**

```bash
cat prisma/migrations/$(ls prisma/migrations | grep add_cover_letter_content)/migration.sql
```

Expected to contain:
```sql
ALTER TABLE "CoverLetterDocument" ADD COLUMN "content" TEXT NOT NULL DEFAULT '';
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema/cover-letter.prisma prisma/migrations/
git commit -m "feat(schema): add content field to CoverLetterDocument"
```

---

### Task 2: Module schema.ts + test

**Files:**
- Create: `src/modules/cover-letters/schema.ts`
- Create: `src/modules/cover-letters/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/cover-letters/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { coverLetterSchema, coverLetterListItemSchema } from './schema'

describe('coverLetterSchema', () => {
  const base = {
    id: 'cl-1',
    profileId: 'profile-1',
    jobApplicationId: null,
    content: 'Dear Hiring Manager,',
    status: 'draft',
    jobTitle: null,
    company: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('accepts a valid cover letter', () => {
    expect(coverLetterSchema.safeParse(base).success).toBe(true)
  })

  it('defaults content to empty string when omitted', () => {
    const { content: _, ...without } = base
    const result = coverLetterSchema.safeParse(without)
    expect(result.success).toBe(true)
    expect(result.data?.content).toBe('')
  })

  it('defaults status to draft when omitted', () => {
    const { status: _, ...without } = base
    const result = coverLetterSchema.safeParse(without)
    expect(result.success).toBe(true)
    expect(result.data?.status).toBe('draft')
  })
})

describe('coverLetterListItemSchema', () => {
  it('accepts a valid list item', () => {
    const result = coverLetterListItemSchema.safeParse({
      id: 'cl-1',
      jobTitle: 'Senior PM',
      company: 'Acme',
      jobApplicationId: 'job-1',
      content: 'Dear Hiring Manager, I am writing…',
      status: 'draft',
      updatedAt: new Date(),
      createdAt: new Date(),
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/modules/cover-letters/schema.test.ts
```

Expected: FAIL — `Cannot find module './schema'`

- [ ] **Step 3: Write the schema**

Create `src/modules/cover-letters/schema.ts`:

```ts
import * as z from 'zod'

export const coverLetterSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  jobApplicationId: z.string().nullable(),
  content: z.string().default(''),
  status: z.string().default('draft'),
  jobTitle: z.string().nullable(),
  company: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type CoverLetter = z.infer<typeof coverLetterSchema>

export const coverLetterListItemSchema = coverLetterSchema.omit({ profileId: true })

export type CoverLetterListItem = z.infer<typeof coverLetterListItemSchema>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/modules/cover-letters/schema.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/cover-letters/schema.ts src/modules/cover-letters/schema.test.ts
git commit -m "feat(cover-letters): module schema and types"
```

---

### Task 3: Module queries.ts + test

**Files:**
- Create: `src/modules/cover-letters/queries.ts`
- Create: `src/modules/cover-letters/queries.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/cover-letters/queries.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    coverLetterDocument: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { listCoverLetters, getCoverLetter } from './queries'
import { prisma } from '@/lib/db'

const mockFindMany = vi.mocked(prisma.coverLetterDocument.findMany)
const mockFindFirst = vi.mocked(prisma.coverLetterDocument.findFirst)

describe('listCoverLetters', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries by profileId ordered by updatedAt desc', async () => {
    mockFindMany.mockResolvedValue([])
    await listCoverLetters('profile-1')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: 'profile-1' },
        orderBy: { updatedAt: 'desc' },
      })
    )
  })

  it('returns all letters', async () => {
    const rows = [
      { id: 'cl-1', jobTitle: 'PM', company: 'Acme', status: 'draft', content: 'Dear…', jobApplicationId: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'cl-2', jobTitle: 'Head of Product', company: 'Stripe', status: 'draft', content: '', jobApplicationId: 'job-1', createdAt: new Date(), updatedAt: new Date() },
    ]
    mockFindMany.mockResolvedValue(rows as never)
    const result = await listCoverLetters('profile-1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('cl-1')
  })
})

describe('getCoverLetter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(null)
    const result = await getCoverLetter('profile-1', 'cl-none')
    expect(result).toBeNull()
  })

  it('queries by id and profileId', async () => {
    mockFindFirst.mockResolvedValue(null)
    await getCoverLetter('profile-1', 'cl-1')
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cl-1', profileId: 'profile-1' },
      })
    )
  })

  it('returns letter with nested jobApplication', async () => {
    const row = {
      id: 'cl-1',
      content: 'Hello',
      status: 'draft',
      jobTitle: 'PM',
      company: 'Acme',
      jobApplicationId: 'job-1',
      jobApplication: {
        id: 'job-1',
        title: 'PM',
        company: 'Acme',
        status: 'applied',
        jobFit: null,
        jobAnalysis: null,
        jobDescription: null,
      },
    }
    mockFindFirst.mockResolvedValue(row as never)
    const result = await getCoverLetter('profile-1', 'cl-1')
    expect(result?.jobApplication?.id).toBe('job-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/modules/cover-letters/queries.test.ts
```

Expected: FAIL — `Cannot find module './queries'`

- [ ] **Step 3: Write the queries**

Create `src/modules/cover-letters/queries.ts`:

```ts
import { prisma } from '@/lib/db'

export type CoverLetterListItem = {
  id: string
  jobTitle: string | null
  company: string | null
  jobApplicationId: string | null
  content: string
  status: string
  updatedAt: Date
  createdAt: Date
}

export type CoverLetterWithJob = {
  id: string
  content: string
  status: string
  jobTitle: string | null
  company: string | null
  jobApplicationId: string | null
  jobApplication: {
    id: string
    title: string
    company: string | null
    status: string
    jobFit: unknown
    jobAnalysis: unknown
    jobDescription: string | null
  } | null
}

export async function listCoverLetters(profileId: string): Promise<CoverLetterListItem[]> {
  return prisma.coverLetterDocument.findMany({
    where: { profileId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      jobTitle: true,
      company: true,
      jobApplicationId: true,
      content: true,
      status: true,
      updatedAt: true,
      createdAt: true,
    },
  })
}

export async function getCoverLetter(
  profileId: string,
  id: string
): Promise<CoverLetterWithJob | null> {
  return prisma.coverLetterDocument.findFirst({
    where: { id, profileId },
    select: {
      id: true,
      content: true,
      status: true,
      jobTitle: true,
      company: true,
      jobApplicationId: true,
      jobApplication: {
        select: {
          id: true,
          title: true,
          company: true,
          status: true,
          jobFit: true,
          jobAnalysis: true,
          jobDescription: true,
        },
      },
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/modules/cover-letters/queries.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/cover-letters/queries.ts src/modules/cover-letters/queries.test.ts
git commit -m "feat(cover-letters): queries — listCoverLetters, getCoverLetter"
```

---

### Task 4: Module actions.ts + test

**Files:**
- Create: `src/modules/cover-letters/actions.ts`
- Create: `src/modules/cover-letters/actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/cover-letters/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({
  requireProfile: vi.fn().mockResolvedValue({ profile: { id: 'profile-1' } }),
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

import { createCoverLetter, updateCoverLetterContent, deleteCoverLetter } from './actions'
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
          content: '',
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/modules/cover-letters/actions.test.ts
```

Expected: FAIL — `Cannot find module './actions'`

- [ ] **Step 3: Write the actions**

Create `src/modules/cover-letters/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'

export async function createCoverLetter(jobApplicationId?: string): Promise<{ id: string }> {
  const { profile } = await requireProfile()

  let jobTitle: string | null = null
  let company: string | null = null

  if (jobApplicationId) {
    const job = await prisma.jobApplication.findFirst({
      where: { id: jobApplicationId, profileId: profile.id },
      select: { title: true, company: true },
    })
    if (job) {
      jobTitle = job.title
      company = job.company ?? null
    }
  }

  const letter = await prisma.coverLetterDocument.create({
    data: {
      profileId: profile.id,
      jobApplicationId: jobApplicationId ?? null,
      jobTitle,
      company,
      mode: 'markdown',
      status: 'draft',
      content: '',
    },
    select: { id: true },
  })

  revalidatePath('/dashboard/cover-letters')
  return { id: letter.id }
}

export async function updateCoverLetterContent(id: string, content: string): Promise<void> {
  const { profile } = await requireProfile()

  const updated = await prisma.coverLetterDocument.updateMany({
    where: { id, profileId: profile.id },
    data: { content },
  })

  if (updated.count === 0) throw new Error('Cover letter not found')
}

export async function deleteCoverLetter(id: string): Promise<void> {
  const { profile } = await requireProfile()

  const deleted = await prisma.coverLetterDocument.deleteMany({
    where: { id, profileId: profile.id },
  })

  if (deleted.count === 0) throw new Error('Cover letter not found')

  revalidatePath('/dashboard/cover-letters')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/modules/cover-letters/actions.test.ts
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/cover-letters/actions.ts src/modules/cover-letters/actions.test.ts
git commit -m "feat(cover-letters): actions — create, updateContent, delete"
```

---

### Task 5: Index page + sidebar nav

**Files:**
- Create: `src/app/dashboard/cover-letters/page.tsx`
- Modify: `src/lib/nav-menu.ts`

- [ ] **Step 1: Add Cover Letters to the sidebar nav**

In `src/lib/nav-menu.ts`, add `Mail` to the imports and a new nav item after CV Builder:

```ts
import {
  ClipboardList,
  Compass,
  FileText,
  HomeIcon,
  Mail,
  UserRound,
  type LucideIcon
} from "lucide-react"

export type NavItem = {
  destination: string
  label: string
  Icon: LucideIcon
}

export const mainNav: NavItem[] = [
  { destination: "/dashboard", label: "Home", Icon: HomeIcon },
  { destination: "/dashboard/onboarding", label: "Search Context", Icon: Compass },
  { destination: "/dashboard/profile", label: "Professional Profile", Icon: UserRound },
  { destination: "/dashboard/job-applications", label: "Job Applications", Icon: ClipboardList },
  { destination: "/dashboard/cv-builder", label: "CV Builder", Icon: FileText },
  { destination: "/dashboard/cover-letters", label: "Cover Letters", Icon: Mail },
]
```

- [ ] **Step 2: Create the index page**

Create `src/app/dashboard/cover-letters/page.tsx`:

```tsx
import Link from 'next/link'
import { requireProfile } from '@/lib/session'
import { listCoverLetters } from '@/modules/cover-letters/queries'
import { daysAgo, formatRelative } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function CoverLettersPage() {
  const { profile } = await requireProfile()
  const letters = await listCoverLetters(profile.id)

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cover Letters</h1>
          {letters.length > 0 && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {letters.length} {letters.length === 1 ? 'letter' : 'letters'}
            </p>
          )}
        </div>
        <Button size="sm" asChild>
          <Link href="/dashboard/cover-letters/new">+ New</Link>
        </Button>
      </div>

      {letters.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          <p>No cover letters yet.</p>
          <p className="mt-1">
            <Link href="/dashboard/job-applications" className="underline">
              Start from a job application →
            </Link>{' '}
            or{' '}
            <Link href="/dashboard/cover-letters/new" className="underline">
              write a standalone letter
            </Link>.
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border/50 rounded-md border">
            {letters.map(letter => {
              const snippet = letter.content.split('\n').find(l => l.trim()) ?? ''
              const days = daysAgo(letter.updatedAt)
              return (
                <Link
                  key={letter.id}
                  href={`/dashboard/cover-letters/${letter.id}`}
                  className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {letter.jobTitle ?? 'Untitled'}
                      {letter.company ? ` · ${letter.company}` : ''}
                    </p>
                    {snippet && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{snippet}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn(
                      'text-xs',
                      letter.status === 'sent'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    )}>
                      {letter.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {days !== null ? formatRelative(days) : ''}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            <Link href="/dashboard/job-applications" className="underline">
              Start a new letter from any job application in the jobs list →
            </Link>
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep cover-letter
```

Expected: no errors for cover-letter files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/nav-menu.ts src/app/dashboard/cover-letters/page.tsx
git commit -m "feat(cover-letters): index page and sidebar nav item"
```

---

### Task 6: `/new` route — server create-and-redirect

**Files:**
- Create: `src/app/dashboard/cover-letters/new/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/dashboard/cover-letters/new/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createCoverLetter } from '@/modules/cover-letters/actions'

export default async function NewCoverLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>
}) {
  const { jobId } = await searchParams
  const { id } = await createCoverLetter(jobId)
  redirect(`/dashboard/cover-letters/${id}`)
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep cover-letter
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/cover-letters/new/page.tsx
git commit -m "feat(cover-letters): /new route — create and redirect to workspace"
```

---

### Task 7: Workspace client component

**Files:**
- Create: `src/app/dashboard/cover-letters/[id]/_components/cover-letter-workspace.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/dashboard/cover-letters/[id]/_components/cover-letter-workspace.tsx`:

```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { updateCoverLetterContent } from '@/modules/cover-letters/actions'
import { JobAnalysisSchema } from '@/modules/jobs/schema'
import type { CoverLetterWithJob } from '@/modules/cover-letters/queries'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function CoverLetterWorkspace({ letter }: { letter: CoverLetterWithJob }) {
  const [content, setContent] = useState(letter.content)
  const [mode, setMode] = useState<'markdown' | 'preview'>('markdown')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [panelOpen, setPanelOpen] = useState(false)
  const [showEditor, setShowEditor] = useState(letter.content !== '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const save = useCallback(async (value: string) => {
    setSaveState('saving')
    try {
      await updateCoverLetterContent(letter.id, value)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }, [letter.id])

  function handleChange(value: string) {
    setContent(value)
    setSaveState('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(value), 1500)
  }

  function handleStartWriting() {
    setShowEditor(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const job = letter.jobApplication
  const analysis = job?.jobAnalysis
    ? JobAnalysisSchema.safeParse(job.jobAnalysis).data ?? null
    : null
  const title = letter.jobTitle ?? job?.title ?? null
  const company = letter.company ?? job?.company ?? null

  const saveLabel =
    saveState === 'saving' ? 'Saving…' :
    saveState === 'saved' ? 'Saved' :
    saveState === 'error' ? 'Save failed' :
    ''

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-4 border-b px-4 py-2">
        {/* Left */}
        <div className="min-w-0 flex-1">
          {title ? (
            <>
              <p className="truncate text-sm font-semibold">
                {title}{company ? ` · ${company}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">Cover Letter</p>
            </>
          ) : (
            <p className="text-sm font-semibold">Cover Letter</p>
          )}
        </div>

        {/* Centre: mode toggle */}
        <div className="flex shrink-0 overflow-hidden rounded-md border text-xs">
          <button
            onClick={() => setMode('markdown')}
            className={cn(
              'px-3 py-1.5 transition-colors',
              mode === 'markdown'
                ? 'bg-foreground font-semibold text-background'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Markdown
          </button>
          <button
            onClick={() => setMode('preview')}
            className={cn(
              'px-3 py-1.5 transition-colors',
              mode === 'preview'
                ? 'bg-foreground font-semibold text-background'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Preview
          </button>
        </div>

        {/* Right */}
        <div className="flex shrink-0 items-center gap-2">
          {saveLabel && (
            <span className={cn(
              'text-xs',
              saveState === 'error' ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {saveLabel}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigator.clipboard.writeText(content)}
          >
            Copy
          </Button>
          {letter.jobApplicationId && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPanelOpen(o => !o)}
            >
              Job ▸
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Editor / preview area */}
        <div
          className={cn(
            'flex flex-1 justify-center overflow-y-auto bg-secondary p-5 transition-opacity',
            panelOpen && 'opacity-50'
          )}
        >
          <div className="w-full max-w-[560px] rounded-md bg-background p-5 shadow-sm">
            {!showEditor && content === '' ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm font-semibold">No cover letter yet</p>
                <p className="max-w-[280px] text-xs text-muted-foreground">
                  Start writing your cover letter for this role, or open the writing guide to help prepare a draft.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleStartWriting}>
                    Start writing
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    title="Coming soon — requires AI to be configured"
                  >
                    Writing guide
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground opacity-50">
                  Writing guide requires AI to be configured
                </p>
              </div>
            ) : mode === 'markdown' ? (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => handleChange(e.target.value)}
                className="min-h-[400px] w-full resize-none bg-transparent font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
                placeholder="Start writing…"
                autoFocus={showEditor && content === ''}
              />
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content || '*No content yet.*'}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Job context panel */}
        {panelOpen && job && (
          <div className="flex w-[42%] min-w-[240px] flex-col border-l bg-background p-4 overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Job Context</span>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close job context panel"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-sm font-medium">{job.title}</p>
            {job.company && (
              <p className="text-xs text-muted-foreground">{job.company}</p>
            )}
            <p className="mb-3 text-xs text-muted-foreground capitalize">{job.status}</p>

            {analysis ? (
              <>
                {analysis.mustHave.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Must-haves
                    </p>
                    {analysis.mustHave.map((item, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {item}</p>
                    ))}
                  </div>
                )}
                {analysis.niceToHave.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Nice-to-haves
                    </p>
                    {analysis.niceToHave.map((item, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {item}</p>
                    ))}
                  </div>
                )}
              </>
            ) : job.jobDescription ? (
              <div className="mb-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Job Description
                </p>
                <p className="text-xs text-muted-foreground line-clamp-5">
                  {job.jobDescription.slice(0, 300)}
                </p>
                <a
                  href={`/dashboard/job-applications/view/${job.id}`}
                  className="mt-1 text-xs underline"
                >
                  View full description →
                </a>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No job description or analysis available.
              </p>
            )}

            <div className="mt-auto border-t pt-3">
              <p className="text-[10px] text-muted-foreground opacity-50">
                ✦ Writing guide — coming soon
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep cover-letter
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/cover-letters/[id]/_components/cover-letter-workspace.tsx
git commit -m "feat(cover-letters): workspace client component with auto-save and job panel"
```

---

### Task 8: Workspace page

**Files:**
- Create: `src/app/dashboard/cover-letters/[id]/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/dashboard/cover-letters/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/session'
import { getCoverLetter } from '@/modules/cover-letters/queries'
import { CoverLetterWorkspace } from './_components/cover-letter-workspace'

type Props = { params: Promise<{ id: string }> }

export default async function CoverLetterPage({ params }: Props) {
  const { id } = await params
  const { profile } = await requireProfile()
  const letter = await getCoverLetter(profile.id, id)
  if (!letter) notFound()
  return <CoverLetterWorkspace letter={letter} />
}
```

- [ ] **Step 2: Typecheck all new files**

```bash
npm run typecheck
```

Expected: no new errors. If `'react-markdown'` types warn, ensure `@types/react-markdown` is not needed — `react-markdown` v10 ships its own types.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/cover-letters/[id]/page.tsx
git commit -m "feat(cover-letters): workspace page"
```

---

### Task 9: Job row integration

**Files:**
- Modify: `src/app/types/job-application.ts`
- Modify: `src/modules/jobs/queries.ts`
- Modify: `src/components/app-item-menu.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-row.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-row-card.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-group.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-list.tsx`

- [ ] **Step 1: Add `coverLetterDocumentId` to the Job type**

In `src/app/types/job-application.ts`, update the `Job` type (currently ends at line 89):

```ts
export type Job = Omit<JobApplication, "status" | "progress" | "jobFit" | "applicationSource"> & {
  status: ApplicationStatusType
  progress: ApplicationProgressType
  jobFit?: JobFit | null
  applicationSource: ApplicationSourceType
  cvDocumentId?: string | null
  coverLetterDocumentId?: string | null
}
```

- [ ] **Step 2: Update `getActiveJobs` and `getArchivedJobs` to include coverLetters**

In `src/modules/jobs/queries.ts`, update both `getActiveJobs` (line ~76) and `getArchivedJobs` (line ~101) to include the first cover letter. The current `include` block for `cvDocuments` needs a parallel `coverLetters` entry:

```ts
export async function getActiveJobs(): Promise<Job[]> {
  const { profile } = await requireProfile()
  const jobs = await prisma.jobApplication.findMany({
    where: { profileId: profile.id, archivedAt: null },
    orderBy: [{ dateApplied: { sort: 'desc', nulls: 'last' } }, { lastUpdated: 'desc' }],
    include: {
      cvDocuments: {
        select: { id: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
      coverLetters: {
        select: { id: true },
        take: 1,
        orderBy: { updatedAt: 'desc' },
      },
    },
  })
  return jobs.map(j => ({
    ...j,
    cvDocumentId: j.cvDocuments[0]?.id ?? null,
    coverLetterDocumentId: j.coverLetters[0]?.id ?? null,
  })) as Job[]
}

export async function getArchivedJobs(): Promise<Job[]> {
  const { profile } = await requireProfile()
  const jobs = await prisma.jobApplication.findMany({
    where: { profileId: profile.id, archivedAt: { not: null } },
    orderBy: [{ archivedAt: 'desc' }],
    include: {
      cvDocuments: {
        select: { id: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
      coverLetters: {
        select: { id: true },
        take: 1,
        orderBy: { updatedAt: 'desc' },
      },
    },
  })
  return jobs.map(j => ({
    ...j,
    cvDocumentId: j.cvDocuments[0]?.id ?? null,
    coverLetterDocumentId: j.coverLetters[0]?.id ?? null,
  })) as Job[]
}
```

- [ ] **Step 3: Update `AppControls` to support cover letter actions**

In `src/components/app-item-menu.tsx`, update the type and component. Add `Mail` to lucide imports, add two new props, and insert the cover letter item after the CV item in the File Management group:

```ts
import Link from "next/link"
import {
  Archive,
  FileText,
  FilePlus,
  Inspect,
  LucideIcon,
  Mail,
  MoreHorizontal,
  Pencil,
  Trash
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type AppControlsProps = {
  id: string
  cvDocumentId?: string | null
  coverLetterDocumentId?: string | null
  onEdit?: () => void
  onArchive?: () => void
  onGenerateCV?: () => void
  onCreateCoverLetter?: () => void
}

export function AppControls({ id, cvDocumentId, coverLetterDocumentId, onEdit, onArchive, onGenerateCV, onCreateCoverLetter }: AppControlsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Job actions"
        className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">Quick Actions</DropdownMenuLabel>
          <AppControlsItem
            Icon={Inspect}
            label="View"
            action={`/dashboard/job-applications/view/${id}`}
            shortcut="V"
          />
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">File Management</DropdownMenuLabel>
          {cvDocumentId ? (
            <AppControlsItem
              Icon={FileText}
              label="View CV"
              action={`/dashboard/cv-builder/${cvDocumentId}`}
              shortcut="⌘D"
            />
          ) : (
            <AppControlsItem
              Icon={FileText}
              label="Generate CV"
              onSelect={onGenerateCV}
              action={onGenerateCV ? undefined : `/dashboard/cv-builder/new?jobId=${id}`}
              shortcut="⌘D"
            />
          )}
          {coverLetterDocumentId ? (
            <AppControlsItem
              Icon={Mail}
              label="View Cover Letter"
              action={`/dashboard/cover-letters/${coverLetterDocumentId}`}
            />
          ) : (
            <AppControlsItem
              Icon={Mail}
              label="Create Cover Letter"
              onSelect={onCreateCoverLetter}
              action={onCreateCoverLetter ? undefined : `/dashboard/cover-letters/new?jobId=${id}`}
            />
          )}
          <AppControlsItem
            Icon={FilePlus}
            label="Add File"
            disabled
            shortcut="⌘F"
          />
          <AppControlsItem
            Icon={Pencil}
            label="Edit"
            onSelect={onEdit}
            disabled={!onEdit}
            shortcut="⌘E"
          />
          <AppControlsItem
            Icon={Archive}
            label="Archive"
            onSelect={onArchive}
            disabled={!onArchive}
          />
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <AppControlsItem
            Icon={Trash}
            label="Delete Job"
            color="red"
            disabled
          />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

Keep the existing `AppControlsItem` function and `AppControlsItemProps` type unchanged at the bottom of the file.

- [ ] **Step 4: Update `job-row.tsx` to pass `coverLetterDocumentId`**

In `src/app/dashboard/job-applications/_components/job-row.tsx`, the component already destructures `cvDocumentId` from `job`. Add `coverLetterDocumentId` to the destructure and pass it to `AppControls`.

Find the line that destructures job fields (currently includes `cvDocumentId`). Update it to also include `coverLetterDocumentId`:

```ts
const {
  id, jobNumber, title, company, countries, url,
  dateApplied, datePublished, lastUpdated, status, progress,
  jobFit, notes, notesIncludeInFit, applicationSource,
  jobDescription, salaryBand, cvDocumentId, coverLetterDocumentId,
} = job
```

Find the `AppControls` block (around line 179) and add `coverLetterDocumentId`:

```tsx
<AppControls
  id={id}
  cvDocumentId={cvDocumentId}
  coverLetterDocumentId={coverLetterDocumentId}
  onEdit={() => onEdit(job)}
  onArchive={() => onArchive(id)}
  onGenerateCV={() => onGenerateCV(id)}
  onCreateCoverLetter={() => onCreateCoverLetter(id)}
/>
```

Also add `onCreateCoverLetter: (id: string) => void` to the `JobRowProps` type and destructure it in the function signature.

- [ ] **Step 5: Update `job-row-card.tsx` (mobile) to pass `coverLetterDocumentId`**

In `src/app/dashboard/job-applications/_components/job-row-card.tsx`:

Add `onCreateCoverLetter: (id: string) => void` to the `JobRowCardProps` type:

```ts
type JobRowCardProps = {
  job: Job
  selected: boolean
  busyLabel?: string
  onToggleSelect: (id: string) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  onGenerateCV: (id: string) => void
  onCreateCoverLetter: (id: string) => void
  hasLLMKey: boolean
}
```

Update the function signature to include it:

```ts
export function JobRowCard({ job, selected, busyLabel, onToggleSelect, onEdit, onArchive, onGenerateCV, onCreateCoverLetter, hasLLMKey }: JobRowCardProps) {
```

Update the `AppControls` call at line 114:

```tsx
<AppControls
  id={id}
  cvDocumentId={job.cvDocumentId}
  coverLetterDocumentId={job.coverLetterDocumentId}
  onEdit={() => onEdit(job)}
  onArchive={() => onArchive(id)}
  onGenerateCV={() => onGenerateCV(id)}
  onCreateCoverLetter={() => onCreateCoverLetter(id)}
/>
```

- [ ] **Step 6: Update `job-group.tsx` to thread `onCreateCoverLetter`**

In `src/app/dashboard/job-applications/_components/job-group.tsx`:

Add `onCreateCoverLetter: (id: string) => void` to `JobGroupProps` and thread it to `JobRowCard` and `JobRow`:

```ts
type JobGroupProps = {
  label: string | null
  groupKey: string
  jobs: Job[]
  selected: Set<string>
  busyRows: Map<string, string>
  onToggleSelect: (id: string) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  onGenerateCV: (id: string) => void
  onCreateCoverLetter: (id: string) => void
  defaultCollapsed?: boolean
  hasLLMKey: boolean
  isMobile?: boolean
}
```

Add `onCreateCoverLetter` to the destructure in the function body, and pass it to both `<JobRowCard>` and `<JobRow>` components in the render:

```tsx
<JobRowCard
  key={job.id}
  job={job}
  selected={selected.has(job.id)}
  busyLabel={busyRows.get(job.id)}
  onToggleSelect={onToggleSelect}
  onEdit={onEdit}
  onArchive={onArchive}
  onGenerateCV={onGenerateCV}
  onCreateCoverLetter={onCreateCoverLetter}
  hasLLMKey={hasLLMKey}
/>
```

```tsx
<JobRow
  key={job.id}
  job={job}
  selected={selected.has(job.id)}
  busyLabel={busyRows.get(job.id)}
  onToggleSelect={onToggleSelect}
  onEdit={onEdit}
  onArchive={onArchive}
  onGenerateCV={onGenerateCV}
  onCreateCoverLetter={onCreateCoverLetter}
  hasLLMKey={hasLLMKey}
/>
```

- [ ] **Step 7: Update `job-list.tsx` to add `handleCreateCoverLetter`**

In `src/app/dashboard/job-applications/_components/job-list.tsx`, add `handleCreateCoverLetter` next to `handleGenerateCV` (around line 249):

```ts
function handleCreateCoverLetter(id: string) {
  router.push(`/dashboard/cover-letters/new?jobId=${id}`)
}
```

Pass it to all `<JobGroup>` components. There are two `<JobGroup>` usages (mobile and desktop). Add the prop to both:

```tsx
<JobGroup
  key={g.key}
  groupKey={g.key}
  label={g.label}
  jobs={g.jobs}
  defaultCollapsed={g.defaultCollapsed}
  selected={selected}
  busyRows={busyRows}
  onToggleSelect={toggleSelect}
  onEdit={setEditing}
  onArchive={handleSingleArchive}
  onGenerateCV={handleGenerateCV}
  onCreateCoverLetter={handleCreateCoverLetter}
  hasLLMKey={hasLLMKey}
  isMobile   {/* or omit on the desktop one */}
/>
```

- [ ] **Step 8: Typecheck the whole project**

```bash
npm run typecheck
```

Expected: no errors. If there are type mismatches on `job-row.tsx` (because `JobRowProps` also needs `onCreateCoverLetter`), add it the same way as `job-row-card.tsx`.

- [ ] **Step 9: Run all tests**

```bash
npm test
```

Expected: all tests pass (no regressions in existing tests).

- [ ] **Step 10: Commit**

```bash
git add \
  src/app/types/job-application.ts \
  src/modules/jobs/queries.ts \
  src/components/app-item-menu.tsx \
  src/app/dashboard/job-applications/_components/job-row.tsx \
  src/app/dashboard/job-applications/_components/job-row-card.tsx \
  src/app/dashboard/job-applications/_components/job-group.tsx \
  src/app/dashboard/job-applications/_components/job-list.tsx
git commit -m "feat(cover-letters): job row integration — Create/View Cover Letter in AppControls"
```
