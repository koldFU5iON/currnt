# Interview Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Interview Prep war-room workspace — a split-panel page where candidates consolidate prep notes, reference documents, and interviewer profiles for a job interview, with optional AI-powered analysis throughout.

**Architecture:** Four Prisma models (`InterviewPrepSession`, `PrepNote`, `PrepDocument`, `PrepInterviewer`) owned by profileId. The workspace is a split panel: left pane is a block-based notes editor (multiple named `PrepNote` docs, each with its own block array), right pane is a tabbed reference panel (Documents, Interviewers, Q&A). AI is entirely optional — every AI action is user-triggered.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + PostgreSQL, Zod, Tailwind CSS v4 + shadcn/ui, Vitest, `unpdf` (PDF text extraction), `src/modules/llm/client.ts` (AI layer).

---

## File Map

**Create:**
- `prisma/schema/interview-prep.prisma`
- `src/modules/interview-prep/schema.ts`
- `src/modules/interview-prep/schema.test.ts`
- `src/modules/interview-prep/queries.ts`
- `src/modules/interview-prep/queries.test.ts`
- `src/modules/interview-prep/actions.ts`
- `src/modules/interview-prep/actions.test.ts`
- `src/modules/interview-prep/ai-actions.ts`
- `src/app/dashboard/interview-prep/page.tsx`
- `src/app/dashboard/interview-prep/new/page.tsx`
- `src/app/dashboard/interview-prep/[id]/page.tsx`
- `src/app/dashboard/interview-prep/[id]/_components/prep-workspace.tsx`
- `src/app/dashboard/interview-prep/[id]/_components/notes-panel.tsx`
- `src/app/dashboard/interview-prep/[id]/_components/block-index.tsx`
- `src/app/dashboard/interview-prep/[id]/_components/block-editor.tsx`
- `src/app/dashboard/interview-prep/[id]/_components/reference-panel.tsx`
- `src/app/dashboard/interview-prep/[id]/_components/documents-tab.tsx`
- `src/app/dashboard/interview-prep/[id]/_components/interviewers-tab.tsx`
- `src/app/dashboard/interview-prep/[id]/_components/qa-tab.tsx`

**Modify:**
- `src/lib/nav-menu.ts` — add Interview Prep nav item
- `src/app/dashboard/settings/usage/_components/usage-log.tsx` — add feature labels

---

## Task 1: Prisma schema + migration

**Files:**
- Create: `prisma/schema/interview-prep.prisma`

- [ ] **Step 1: Write the schema file**

```prisma
// prisma/schema/interview-prep.prisma

model InterviewPrepSession {
  id               String    @id @default(cuid())
  profileId        String
  title            String
  company          String?
  jobTitle         String?
  jobApplicationId String?
  status           String    @default("draft")
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  profile        Profile              @relation(fields: [profileId], references: [id], onDelete: Cascade)
  jobApplication JobApplication?      @relation(fields: [jobApplicationId], references: [id])
  notes          PrepNote[]
  documents      PrepDocument[]
  interviewers   PrepInterviewer[]

  @@index([profileId])
  @@index([jobApplicationId])
}

model PrepNote {
  id        String   @id @default(cuid())
  sessionId String
  profileId String
  title     String   @default("Prep Notes")
  sections  Json     @default("[]")
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  session InterviewPrepSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}

model PrepDocument {
  id           String    @id @default(cuid())
  sessionId    String
  profileId    String
  name         String
  docType      String    @default("other")
  content      String
  aiAnalysis   Json?
  aiAnalysedAt DateTime?
  createdAt    DateTime  @default(now())

  session InterviewPrepSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}

model PrepInterviewer {
  id            String    @id @default(cuid())
  sessionId     String
  profileId     String
  name          String
  role          String?
  linkedInText  String?
  notes         String?
  aiAnalysis    Json?
  aiAnalysedAt  DateTime?
  createdAt     DateTime  @default(now())

  session InterviewPrepSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}
```

- [ ] **Step 2: Run the migration**

```bash
npm run db:migrate -- --name interview_prep
```

Expected: migration file created in `prisma/migrations/` and applied to local DB. No errors.

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npm run typecheck
```

Expected: passes (or only pre-existing errors — none related to `prepNote`, `prepDocument`, etc.)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema/interview-prep.prisma prisma/migrations/
git commit -m "feat(interview-prep): add Prisma schema and migration"
```

---

## Task 2: Module schema.ts + tests

**Files:**
- Create: `src/modules/interview-prep/schema.ts`
- Create: `src/modules/interview-prep/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/interview-prep/schema.test.ts
import { describe, it, expect } from 'vitest'
import {
  TextBlockSchema,
  AiAnalysisBlockSchema,
  QaBankBlockSchema,
  SectionsSchema,
  PrepSessionSchema,
  normalizeSections,
} from './schema'

describe('TextBlockSchema', () => {
  it('accepts a valid text block', () => {
    const result = TextBlockSchema.safeParse({
      id: 'blk_1', type: 'text', title: 'Key Themes', content: '- point', order: 0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing type', () => {
    const result = TextBlockSchema.safeParse({ id: 'b1', title: 'x', content: '', order: 0 })
    expect(result.success).toBe(false)
  })
})

describe('AiAnalysisBlockSchema', () => {
  it('accepts a block with no source ids', () => {
    const result = AiAnalysisBlockSchema.safeParse({
      id: 'blk_2', type: 'ai-analysis', title: 'Insights', content: 'text', order: 1,
    })
    expect(result.success).toBe(true)
    expect(result.data?.sourceDocIds).toEqual([])
    expect(result.data?.sourceInterviewerIds).toEqual([])
  })

  it('accepts sourceDocIds and sourceInterviewerIds', () => {
    const result = AiAnalysisBlockSchema.safeParse({
      id: 'blk_2', type: 'ai-analysis', title: 'Insights', content: 'text', order: 1,
      sourceDocIds: ['doc_1'], sourceInterviewerIds: ['int_1'],
    })
    expect(result.success).toBe(true)
  })
})

describe('QaBankBlockSchema', () => {
  it('accepts a valid qa-bank block', () => {
    const result = QaBankBlockSchema.safeParse({
      id: 'blk_3', type: 'qa-bank', title: 'Q&A Bank', content: '## Screening\n- Tell me about yourself', order: 2,
    })
    expect(result.success).toBe(true)
  })
})

describe('SectionsSchema', () => {
  it('accepts an empty array', () => {
    expect(SectionsSchema.safeParse([]).success).toBe(true)
  })

  it('accepts a mixed array of block types', () => {
    const result = SectionsSchema.safeParse([
      { id: 'b1', type: 'text', title: 'A', content: '', order: 0 },
      { id: 'b2', type: 'ai-analysis', title: 'B', content: '', order: 1 },
      { id: 'b3', type: 'qa-bank', title: 'C', content: '', order: 2 },
    ])
    expect(result.success).toBe(true)
  })

  it('rejects an unknown block type', () => {
    const result = SectionsSchema.safeParse([
      { id: 'b1', type: 'unknown', title: 'X', content: '', order: 0 },
    ])
    expect(result.success).toBe(false)
  })
})

describe('normalizeSections', () => {
  it('returns empty array for null/undefined', () => {
    expect(normalizeSections(null)).toEqual([])
    expect(normalizeSections(undefined)).toEqual([])
  })

  it('parses a valid sections value from DB', () => {
    const raw = [{ id: 'b1', type: 'text', title: 'A', content: '', order: 0 }]
    expect(normalizeSections(raw)).toHaveLength(1)
  })

  it('returns empty array for invalid shape (graceful fallback)', () => {
    expect(normalizeSections('not an array')).toEqual([])
  })
})

describe('PrepSessionSchema', () => {
  it('accepts a valid session', () => {
    const result = PrepSessionSchema.safeParse({
      id: 's1', profileId: 'p1', title: 'PM @ Acme', company: 'Acme',
      jobTitle: 'PM', jobApplicationId: null, status: 'draft',
      createdAt: new Date(), updatedAt: new Date(),
    })
    expect(result.success).toBe(true)
  })

  it('defaults status to draft', () => {
    const result = PrepSessionSchema.safeParse({
      id: 's1', profileId: 'p1', title: 'PM @ Acme',
      createdAt: new Date(), updatedAt: new Date(),
    })
    expect(result.success).toBe(true)
    expect(result.data?.status).toBe('draft')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/interview-prep/schema.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the schema module**

```ts
// src/modules/interview-prep/schema.ts
import * as z from 'zod'

export const TextBlockSchema = z.object({
  id: z.string(),
  type: z.literal('text'),
  title: z.string(),
  content: z.string(),
  order: z.number(),
})

export const AiAnalysisBlockSchema = z.object({
  id: z.string(),
  type: z.literal('ai-analysis'),
  title: z.string(),
  content: z.string(),
  sourceDocIds: z.array(z.string()).default([]),
  sourceInterviewerIds: z.array(z.string()).default([]),
  order: z.number(),
})

export const QaBankBlockSchema = z.object({
  id: z.string(),
  type: z.literal('qa-bank'),
  title: z.string(),
  content: z.string(),
  order: z.number(),
})

export const BlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  AiAnalysisBlockSchema,
  QaBankBlockSchema,
])

export type TextBlock = z.infer<typeof TextBlockSchema>
export type AiAnalysisBlock = z.infer<typeof AiAnalysisBlockSchema>
export type QaBankBlock = z.infer<typeof QaBankBlockSchema>
export type Block = z.infer<typeof BlockSchema>

export const SectionsSchema = z.array(BlockSchema)
export type Sections = z.infer<typeof SectionsSchema>

export function normalizeSections(raw: unknown): Block[] {
  const result = SectionsSchema.safeParse(raw)
  return result.success ? result.data : []
}

export const PrepSessionSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  title: z.string(),
  company: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  jobApplicationId: z.string().nullable().optional(),
  status: z.string().default('draft'),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type PrepSession = z.infer<typeof PrepSessionSchema>

export const PrepNoteSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  profileId: z.string(),
  title: z.string(),
  sections: SectionsSchema,
  order: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type PrepNote = z.infer<typeof PrepNoteSchema>

export const PrepDocumentSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  profileId: z.string(),
  name: z.string(),
  docType: z.string(),
  content: z.string(),
  aiAnalysis: z.unknown().nullable().optional(),
  aiAnalysedAt: z.date().nullable().optional(),
  createdAt: z.date(),
})

export type PrepDocument = z.infer<typeof PrepDocumentSchema>

export const PrepInterviewerSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  profileId: z.string(),
  name: z.string(),
  role: z.string().nullable().optional(),
  linkedInText: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  aiAnalysis: z.unknown().nullable().optional(),
  aiAnalysedAt: z.date().nullable().optional(),
  createdAt: z.date(),
})

export type PrepInterviewer = z.infer<typeof PrepInterviewerSchema>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/interview-prep/schema.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/interview-prep/schema.ts src/modules/interview-prep/schema.test.ts
git commit -m "feat(interview-prep): add module schema and Zod types"
```

---

## Task 3: Module queries.ts + tests

**Files:**
- Create: `src/modules/interview-prep/queries.ts`
- Create: `src/modules/interview-prep/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/interview-prep/queries.test.ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/interview-prep/queries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the queries module**

```ts
// src/modules/interview-prep/queries.ts
import { prisma } from '@/lib/db'
import { normalizeSections } from './schema'

export type PrepSessionListItem = {
  id: string
  title: string
  company: string | null
  jobTitle: string | null
  status: string
  updatedAt: Date
  createdAt: Date
  _count: { notes: number; documents: number; interviewers: number }
}

export type PrepNoteRow = {
  id: string
  title: string
  sections: ReturnType<typeof normalizeSections>
  order: number
  updatedAt: Date
}

export type PrepDocumentRow = {
  id: string
  name: string
  docType: string
  content: string
  aiAnalysis: unknown
  aiAnalysedAt: Date | null
  createdAt: Date
}

export type PrepInterviewerRow = {
  id: string
  name: string
  role: string | null
  linkedInText: string | null
  notes: string | null
  aiAnalysis: unknown
  aiAnalysedAt: Date | null
  createdAt: Date
}

export type PrepSessionWithChildren = {
  id: string
  title: string
  company: string | null
  jobTitle: string | null
  jobApplicationId: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  notes: PrepNoteRow[]
  documents: PrepDocumentRow[]
  interviewers: PrepInterviewerRow[]
  jobApplication: { id: string; title: string; company: string | null } | null
}

export async function listSessions(profileId: string): Promise<PrepSessionListItem[]> {
  return prisma.interviewPrepSession.findMany({
    where: { profileId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      company: true,
      jobTitle: true,
      status: true,
      updatedAt: true,
      createdAt: true,
      _count: { select: { notes: true, documents: true, interviewers: true } },
    },
  })
}

export async function getSession(
  profileId: string,
  id: string,
): Promise<PrepSessionWithChildren | null> {
  const row = await prisma.interviewPrepSession.findFirst({
    where: { id, profileId },
    select: {
      id: true,
      title: true,
      company: true,
      jobTitle: true,
      jobApplicationId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      jobApplication: { select: { id: true, title: true, company: true } },
      notes: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, sections: true, order: true, updatedAt: true },
      },
      documents: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, docType: true, content: true, aiAnalysis: true, aiAnalysedAt: true, createdAt: true },
      },
      interviewers: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, role: true, linkedInText: true, notes: true, aiAnalysis: true, aiAnalysedAt: true, createdAt: true },
      },
    },
  })

  if (!row) return null

  return {
    ...row,
    notes: row.notes.map(n => ({
      ...n,
      sections: normalizeSections(n.sections),
    })),
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/interview-prep/queries.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/interview-prep/queries.ts src/modules/interview-prep/queries.test.ts
git commit -m "feat(interview-prep): add queries module"
```

---

## Task 4: actions.ts — session + note operations

**Files:**
- Create: `src/modules/interview-prep/actions.ts` (initial)
- Create: `src/modules/interview-prep/actions.test.ts` (initial)

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/interview-prep/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({
  requireProfile: vi.fn().mockResolvedValue({ profile: { id: 'profile-1' } }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    interviewPrepSession: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    prepNote: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn() },
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
    const result = await createNote('sess-1', 'Hiring Manager')
    expect(mockNoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionId: 'sess-1', profileId: 'profile-1', title: 'Hiring Manager' }),
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/interview-prep/actions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the session + note actions**

```ts
// src/modules/interview-prep/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'

// ─── Session ─────────────────────────────────────────────────

export async function createSession(input: {
  title: string
  company?: string
  jobTitle?: string
  jobApplicationId?: string
}): Promise<{ id: string }> {
  const { profile } = await requireProfile()

  let company = input.company ?? null
  let jobTitle = input.jobTitle ?? null

  if (input.jobApplicationId) {
    const job = await prisma.jobApplication.findFirst({
      where: { id: input.jobApplicationId, profileId: profile.id },
      select: { title: true, company: true },
    })
    if (job) {
      jobTitle = jobTitle ?? job.title
      company = company ?? job.company ?? null
    }
  }

  const session = await prisma.interviewPrepSession.create({
    data: {
      profileId: profile.id,
      title: input.title,
      company,
      jobTitle,
      jobApplicationId: input.jobApplicationId ?? null,
    },
    select: { id: true },
  })

  await prisma.prepNote.create({
    data: {
      sessionId: session.id,
      profileId: profile.id,
      title: 'Prep Notes',
      order: 0,
    },
  })

  revalidatePath('/dashboard/interview-prep')
  return { id: session.id }
}

export async function updateSessionDetails(
  sessionId: string,
  input: { title?: string; company?: string; jobTitle?: string },
): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.interviewPrepSession.updateMany({
    where: { id: sessionId, profileId: profile.id },
    data: input,
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
}

export async function linkSessionToJob(
  sessionId: string,
  jobApplicationId: string | null,
): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.interviewPrepSession.updateMany({
    where: { id: sessionId, profileId: profile.id },
    data: { jobApplicationId },
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.interviewPrepSession.deleteMany({
    where: { id: sessionId, profileId: profile.id },
  })
  revalidatePath('/dashboard/interview-prep')
}

// ─── Notes ───────────────────────────────────────────────────

export async function createNote(sessionId: string, title: string): Promise<{ id: string }> {
  const { profile } = await requireProfile()
  const count = await prisma.prepNote.count({ where: { sessionId, profileId: profile.id } })
  const note = await prisma.prepNote.create({
    data: { sessionId, profileId: profile.id, title, order: count },
    select: { id: true },
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
  return { id: note.id }
}

export async function renameNote(noteId: string, title: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.prepNote.updateMany({
    where: { id: noteId, profileId: profile.id },
    data: { title },
  })
}

export async function deleteNote(noteId: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.prepNote.deleteMany({
    where: { id: noteId, profileId: profile.id },
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/interview-prep/actions.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/interview-prep/actions.ts src/modules/interview-prep/actions.test.ts
git commit -m "feat(interview-prep): add session and note actions"
```

---

## Task 5: actions.ts — document + interviewer operations

**Files:**
- Modify: `src/modules/interview-prep/actions.ts`
- Modify: `src/modules/interview-prep/actions.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/modules/interview-prep/actions.test.ts`:

```ts
import {
  addDocument, deleteDocument,
  addInterviewer, updateInterviewer, deleteInterviewer,
} from './actions'

const mockDocCreate = vi.mocked(prisma.prepDocument.create)
const mockDocDelete = vi.mocked(prisma.prepDocument.deleteMany)
const mockInterviewerCreate = vi.mocked(prisma.prepInterviewer.create)
const mockInterviewerUpdate = vi.mocked(prisma.prepInterviewer.updateMany)
const mockInterviewerDelete = vi.mocked(prisma.prepInterviewer.deleteMany)

describe('addDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a document scoped to session and profile', async () => {
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

  it('deletes scoped to profileId', async () => {
    mockDocDelete.mockResolvedValue({ count: 1 } as never)
    await deleteDocument('doc-1')
    expect(mockDocDelete).toHaveBeenCalledWith({
      where: { id: 'doc-1', profileId: 'profile-1' },
    })
  })
})

describe('addInterviewer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an interviewer record', async () => {
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

  it('deletes scoped to profileId', async () => {
    mockInterviewerDelete.mockResolvedValue({ count: 1 } as never)
    await deleteInterviewer('int-1')
    expect(mockInterviewerDelete).toHaveBeenCalledWith({
      where: { id: 'int-1', profileId: 'profile-1' },
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/interview-prep/actions.test.ts 2>&1 | grep "FAIL\|not found\|addDocument"
```

Expected: failures for the new tests only.

- [ ] **Step 3: Append document + interviewer actions to `actions.ts`**

```ts
// Append to src/modules/interview-prep/actions.ts

// ─── Documents ───────────────────────────────────────────────

export async function addDocument(
  sessionId: string,
  input: { name: string; docType: string; content: string },
): Promise<{ id: string }> {
  const { profile } = await requireProfile()
  const doc = await prisma.prepDocument.create({
    data: { sessionId, profileId: profile.id, ...input },
    select: { id: true },
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
  return { id: doc.id }
}

export async function deleteDocument(documentId: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.prepDocument.deleteMany({
    where: { id: documentId, profileId: profile.id },
  })
}

// ─── Interviewers ────────────────────────────────────────────

export async function addInterviewer(
  sessionId: string,
  input: { name: string; role?: string; linkedInText?: string; notes?: string },
): Promise<{ id: string }> {
  const { profile } = await requireProfile()
  const interviewer = await prisma.prepInterviewer.create({
    data: { sessionId, profileId: profile.id, ...input },
    select: { id: true },
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
  return { id: interviewer.id }
}

export async function updateInterviewer(
  interviewerId: string,
  input: { name?: string; role?: string; linkedInText?: string; notes?: string },
): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.prepInterviewer.updateMany({
    where: { id: interviewerId, profileId: profile.id },
    data: input,
  })
}

export async function deleteInterviewer(interviewerId: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.prepInterviewer.deleteMany({
    where: { id: interviewerId, profileId: profile.id },
  })
}
```

- [ ] **Step 4: Run all actions tests**

```bash
npx vitest run src/modules/interview-prep/actions.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/interview-prep/actions.ts src/modules/interview-prep/actions.test.ts
git commit -m "feat(interview-prep): add document and interviewer actions"
```

---

## Task 6: actions.ts — block operations

**Files:**
- Modify: `src/modules/interview-prep/actions.ts`
- Modify: `src/modules/interview-prep/actions.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/modules/interview-prep/actions.test.ts`:

```ts
import {
  addTextBlock, updateBlock, deleteBlock, moveBlockUp, moveBlockDown, convertAiBlockToText,
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
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
npx vitest run src/modules/interview-prep/actions.test.ts 2>&1 | grep "FAIL\|addTextBlock"
```

- [ ] **Step 3: Append block operations to `actions.ts`**

```ts
// Append to src/modules/interview-prep/actions.ts
import { normalizeSections } from './schema'
import { nanoid } from 'nanoid'

// ─── Block helpers ────────────────────────────────────────────

async function loadNote(noteId: string, profileId: string) {
  const note = await prisma.prepNote.findFirst({
    where: { id: noteId, profileId },
    select: { id: true, sessionId: true, sections: true },
  })
  if (!note) throw new Error('Note not found')
  return { ...note, blocks: normalizeSections(note.sections) }
}

async function saveBlocks(
  noteId: string,
  sessionId: string,
  blocks: ReturnType<typeof normalizeSections>,
): Promise<void> {
  const reindexed = [...blocks]
    .sort((a, b) => a.order - b.order)
    .map((b, i) => ({ ...b, order: i }))
  await prisma.prepNote.update({
    where: { id: noteId },
    data: { sections: reindexed },
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
}

// ─── Block operations ─────────────────────────────────────────

export async function addTextBlock(noteId: string): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const newBlock = { id: nanoid(), type: 'text' as const, title: 'New block', content: '', order: note.blocks.length }
  await saveBlocks(noteId, note.sessionId, [...note.blocks, newBlock])
}

export async function updateBlock(
  noteId: string,
  blockId: string,
  updates: { title?: string; content?: string },
): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const updated = note.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b)
  await saveBlocks(noteId, note.sessionId, updated)
}

export async function deleteBlock(noteId: string, blockId: string): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const remaining = note.blocks.filter(b => b.id !== blockId)
  await saveBlocks(noteId, note.sessionId, remaining)
}

export async function moveBlockUp(noteId: string, blockId: string): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const sorted = [...note.blocks].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex(b => b.id === blockId)
  if (idx <= 0) return
  ;[sorted[idx - 1], sorted[idx]] = [sorted[idx], sorted[idx - 1]]
  await saveBlocks(noteId, note.sessionId, sorted)
}

export async function moveBlockDown(noteId: string, blockId: string): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const sorted = [...note.blocks].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex(b => b.id === blockId)
  if (idx < 0 || idx >= sorted.length - 1) return
  ;[sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]]
  await saveBlocks(noteId, note.sessionId, sorted)
}

export async function convertAiBlockToText(noteId: string, blockId: string): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const updated = note.blocks.map(b => {
    if (b.id !== blockId || b.type !== 'ai-analysis') return b
    return { id: b.id, type: 'text' as const, title: b.title, content: b.content, order: b.order }
  })
  await saveBlocks(noteId, note.sessionId, updated)
}

export async function insertAiBlock(
  noteId: string,
  block: { title: string; content: string; sourceDocIds?: string[]; sourceInterviewerIds?: string[] },
): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const newBlock = {
    id: nanoid(),
    type: 'ai-analysis' as const,
    title: block.title,
    content: block.content,
    sourceDocIds: block.sourceDocIds ?? [],
    sourceInterviewerIds: block.sourceInterviewerIds ?? [],
    order: note.blocks.length,
  }
  await saveBlocks(noteId, note.sessionId, [...note.blocks, newBlock])
}
```

- [ ] **Step 4: Install nanoid if not present**

```bash
grep '"nanoid"' package.json || npm install nanoid
```

- [ ] **Step 5: Run all actions tests**

```bash
npx vitest run src/modules/interview-prep/actions.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/interview-prep/actions.ts src/modules/interview-prep/actions.test.ts package.json package-lock.json
git commit -m "feat(interview-prep): add block operations actions"
```

---

## Task 7: AI actions module

**Files:**
- Create: `src/modules/interview-prep/ai-actions.ts`

- [ ] **Step 1: Write the AI actions file**

No unit tests for this file — it wraps the LLM client which is integration-tested end-to-end. Follow the same result-type pattern as the writing-guide actions.

```ts
// src/modules/interview-prep/ai-actions.ts
'use server'

import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { complete } from '@/modules/llm/client'
import { LLMError, type LLMErrorKind } from '@/modules/llm/errors'
import { buildProfileSnapshot, serializeProfileForLLM } from '@/modules/profile/snapshot'
import { insertAiBlock } from './actions'

type AIResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'no_content' | LLMErrorKind; message: string }

const DOC_SYSTEM = `You are a career coach helping a candidate prepare for a job interview.
You are given the candidate's career profile, a document from the company (interview pack, process guide, values doc, etc.), and the role they are interviewing for.
Surface insights from the document that are specifically relevant to THIS candidate for THIS role. Ignore generic boilerplate.
Focus on: what the company/interviewer actually cares about, how this candidate's experience connects to those priorities, and anything the candidate should be prepared for.
Write in clear, direct prose. Be specific — reference the candidate's actual experience. Format as markdown.`

const INTERVIEWER_SYSTEM = `You are a career coach helping a candidate prepare for a job interview.
You are given the candidate's career profile, an interviewer's LinkedIn profile or background notes, and the role being interviewed for.
Analyse this interviewer to help the candidate prepare. Cover:
- Who they are and their professional background
- What they likely care about and value based on their career trajectory
- The kinds of questions they are likely to ask or areas they will probe
- How the candidate's specific experience connects to this person's background and interests
Be specific and actionable. Reference the candidate's actual background. Format as markdown with clear sections.`

export async function analyseDocument(
  documentId: string,
  noteId: string,
): Promise<AIResult> {
  const { profile } = await requireProfile()

  const doc = await prisma.prepDocument.findFirst({
    where: { id: documentId, profileId: profile.id },
    select: { id: true, name: true, content: true, session: { select: { title: true, company: true, jobTitle: true } } },
  })
  if (!doc) return { ok: false, error: 'not_found', message: 'Document not found.' }
  if (!doc.content.trim()) return { ok: false, error: 'no_content', message: 'Document has no text content to analyse.' }

  const snapshot = await buildProfileSnapshot(profile.id)
  const profileText = serializeProfileForLLM(snapshot)
  const role = [doc.session.jobTitle, doc.session.company].filter(Boolean).join(' at ') || doc.session.title

  const prompt = `Candidate profile:\n${profileText}\n\nRole: ${role}\n\nDocument (${doc.name}):\n${doc.content}`

  try {
    const content = await complete(profile.id, prompt, {
      feature: 'interview-prep-doc-analysis',
      system: DOC_SYSTEM,
    })

    await prisma.prepDocument.update({
      where: { id: documentId },
      data: { aiAnalysis: { content }, aiAnalysedAt: new Date() },
    })

    await insertAiBlock(noteId, {
      title: `✦ ${doc.name}`,
      content,
      sourceDocIds: [documentId],
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof LLMError) return { ok: false, error: err.kind, message: err.message }
    throw err
  }
}

export async function analyseInterviewer(
  interviewerId: string,
  noteId: string,
): Promise<AIResult> {
  const { profile } = await requireProfile()

  const interviewer = await prisma.prepInterviewer.findFirst({
    where: { id: interviewerId, profileId: profile.id },
    select: {
      id: true, name: true, role: true, linkedInText: true, notes: true,
      session: { select: { title: true, company: true, jobTitle: true } },
    },
  })
  if (!interviewer) return { ok: false, error: 'not_found', message: 'Interviewer not found.' }

  const rawText = [interviewer.linkedInText, interviewer.notes].filter(Boolean).join('\n\n')
  if (!rawText.trim()) return { ok: false, error: 'no_content', message: 'No LinkedIn profile or notes found for this interviewer.' }

  const snapshot = await buildProfileSnapshot(profile.id)
  const profileText = serializeProfileForLLM(snapshot)
  const role = [interviewer.session.jobTitle, interviewer.session.company].filter(Boolean).join(' at ') || interviewer.session.title
  const interviewerLabel = [interviewer.name, interviewer.role].filter(Boolean).join(', ')

  const prompt = `Candidate profile:\n${profileText}\n\nRole: ${role}\n\nInterviewer — ${interviewerLabel}:\n${rawText}`

  try {
    const content = await complete(profile.id, prompt, {
      feature: 'interview-prep-interviewer-analysis',
      system: INTERVIEWER_SYSTEM,
    })

    await prisma.prepInterviewer.update({
      where: { id: interviewerId },
      data: { aiAnalysis: { content }, aiAnalysedAt: new Date() },
    })

    await insertAiBlock(noteId, {
      title: `✦ ${interviewer.name}`,
      content,
      sourceInterviewerIds: [interviewerId],
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof LLMError) return { ok: false, error: err.kind, message: err.message }
    throw err
  }
}

export async function analyseAllDocuments(
  sessionId: string,
  noteId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: LLMErrorKind; message: string }> {
  const { profile } = await requireProfile()

  const docs = await prisma.prepDocument.findMany({
    where: { sessionId, profileId: profile.id, aiAnalysedAt: null },
    select: { id: true },
  })

  let count = 0
  for (const doc of docs) {
    const result = await analyseDocument(doc.id, noteId)
    if (!result.ok && result.error !== 'no_content') {
      return { ok: false, error: result.error as LLMErrorKind, message: result.message }
    }
    if (result.ok) count++
  }

  return { ok: true, count }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: passes (or only pre-existing errors).

- [ ] **Step 3: Commit**

```bash
git add src/modules/interview-prep/ai-actions.ts
git commit -m "feat(interview-prep): add AI actions for document and interviewer analysis"
```

---

## Task 8: Session list + creation pages

**Files:**
- Create: `src/app/dashboard/interview-prep/page.tsx`
- Create: `src/app/dashboard/interview-prep/new/page.tsx`

- [ ] **Step 1: Write the list page**

```tsx
// src/app/dashboard/interview-prep/page.tsx
import Link from 'next/link'
import { requireProfile } from '@/lib/session'
import { listSessions } from '@/modules/interview-prep/queries'
import { Button } from '@/components/ui/button'
import { formatRelative, daysAgo } from '@/lib/utils'

export default async function InterviewPrepPage() {
  const { profile } = await requireProfile()
  const sessions = await listSessions(profile.id)

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Interview Prep</h1>
          {sessions.length > 0 && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
            </p>
          )}
        </div>
        <Button size="sm" render={<Link href="/dashboard/interview-prep/new" />}>
          + New
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          <p>No prep sessions yet.</p>
          <p className="mt-1">
            <Link href="/dashboard/interview-prep/new" className="underline">
              Start your first session →
            </Link>
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/50 rounded-md border">
          {sessions.map(session => {
            const days = daysAgo(session.updatedAt)
            return (
              <Link
                key={session.id}
                href={`/dashboard/interview-prep/${session.id}`}
                className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{session.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {session._count.notes} {session._count.notes === 1 ? 'note' : 'notes'}
                    {session._count.documents > 0 && ` · ${session._count.documents} docs`}
                    {session._count.interviewers > 0 && ` · ${session._count.interviewers} interviewers`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">
                    {days !== null ? formatRelative(days) : ''}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write the new session page**

```tsx
// src/app/dashboard/interview-prep/new/page.tsx
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/session'
import { prisma } from '@/lib/db'
import { createSession } from '@/modules/interview-prep/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function NewInterviewPrepPage() {
  const { profile } = await requireProfile()

  const jobs = await prisma.jobApplication.findMany({
    where: { profileId: profile.id, archivedAt: null },
    orderBy: { lastUpdated: 'desc' },
    select: { id: true, title: true, company: true },
    take: 50,
  })

  async function handleCreate(formData: FormData) {
    'use server'
    const title = formData.get('title') as string
    const jobApplicationId = (formData.get('jobApplicationId') as string) || undefined
    if (!title?.trim()) return
    const { id } = await createSession({ title: title.trim(), jobApplicationId })
    redirect(`/dashboard/interview-prep/${id}`)
  }

  return (
    <div className="container max-w-lg py-8">
      <h1 className="mb-6 text-xl font-semibold">New Prep Session</h1>
      <form action={handleCreate} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Session title</Label>
          <Input
            id="title"
            name="title"
            placeholder="e.g. Senior Product Designer @ Acme"
            required
            autoFocus
          />
        </div>

        {jobs.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="jobApplicationId">Link to a job (optional)</Label>
            <select
              id="jobApplicationId"
              name="jobApplicationId"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>
                  {job.title}{job.company ? ` · ${job.company}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Auto-fills company and job title from the linked application.
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit">Create session</Button>
          <Button type="button" variant="ghost" render={<a href="/dashboard/interview-prep" />}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 4: Run dev server and manually verify**

```bash
npm run dev
```

Navigate to `http://localhost:3000/dashboard/interview-prep`. Verify: empty state shows, "+ New" button works, form creates a session and redirects to workspace URL (404 for now — workspace page not yet built).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/interview-prep/
git commit -m "feat(interview-prep): add session list and creation pages"
```

---

## Task 9: Workspace shell

**Files:**
- Create: `src/app/dashboard/interview-prep/[id]/page.tsx`
- Create: `src/app/dashboard/interview-prep/[id]/_components/prep-workspace.tsx`

- [ ] **Step 1: Write the workspace server page**

```tsx
// src/app/dashboard/interview-prep/[id]/page.tsx
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/session'
import { getSession } from '@/modules/interview-prep/queries'
import { PrepWorkspace } from './_components/prep-workspace'

type Props = { params: Promise<{ id: string }> }

export default async function InterviewPrepWorkspacePage({ params }: Props) {
  const [{ id }, { profile }] = await Promise.all([params, requireProfile()])
  const session = await getSession(profile.id, id)
  if (!session) notFound()
  return <PrepWorkspace session={session} />
}
```

- [ ] **Step 2: Write the workspace client shell**

```tsx
// src/app/dashboard/interview-prep/[id]/_components/prep-workspace.tsx
'use client'

import { useState } from 'react'
import type { PrepSessionWithChildren } from '@/modules/interview-prep/queries'
import { NotesPanel } from './notes-panel'
import { ReferencePanel } from './reference-panel'

type Props = { session: PrepSessionWithChildren }

export function PrepWorkspace({ session }: Props) {
  const [activeNoteId, setActiveNoteId] = useState<string>(
    session.notes[0]?.id ?? ''
  )

  const activeNote = session.notes.find(n => n.id === activeNoteId) ?? session.notes[0]

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <NotesPanel
        sessionId={session.id}
        notes={session.notes}
        activeNoteId={activeNoteId}
        onNoteChange={setActiveNoteId}
        activeNote={activeNote}
      />
      <ReferencePanel
        sessionId={session.id}
        activeNoteId={activeNoteId}
        documents={session.documents}
        interviewers={session.interviewers}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create placeholder stubs for NotesPanel and ReferencePanel** (so typecheck passes before building them out)

```tsx
// src/app/dashboard/interview-prep/[id]/_components/notes-panel.tsx
'use client'
import type { PrepNoteRow } from '@/modules/interview-prep/queries'
type Props = {
  sessionId: string
  notes: PrepNoteRow[]
  activeNoteId: string
  onNoteChange: (id: string) => void
  activeNote: PrepNoteRow | undefined
}
export function NotesPanel(_props: Props) {
  return <div className="flex-1 border-r p-4 text-sm text-muted-foreground">Notes panel coming soon</div>
}
```

```tsx
// src/app/dashboard/interview-prep/[id]/_components/reference-panel.tsx
'use client'
import type { PrepDocumentRow, PrepInterviewerRow } from '@/modules/interview-prep/queries'
type Props = {
  sessionId: string
  activeNoteId: string
  documents: PrepDocumentRow[]
  interviewers: PrepInterviewerRow[]
}
export function ReferencePanel(_props: Props) {
  return <div className="w-80 border-l p-4 text-sm text-muted-foreground">Reference panel coming soon</div>
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 5: Verify the workspace route loads**

Navigate to `http://localhost:3000/dashboard/interview-prep/[session-id]`. Expected: split-panel placeholder renders, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/interview-prep/[id]/
git commit -m "feat(interview-prep): add workspace shell and split-panel structure"
```

---

## Task 10: Notes panel — switcher, index, block list

**Files:**
- Modify: `src/app/dashboard/interview-prep/[id]/_components/notes-panel.tsx`
- Create: `src/app/dashboard/interview-prep/[id]/_components/block-index.tsx`

- [ ] **Step 1: Write the block index sidebar**

```tsx
// src/app/dashboard/interview-prep/[id]/_components/block-index.tsx
'use client'

import { cn } from '@/lib/utils'
import type { Block } from '@/modules/interview-prep/schema'

type Props = {
  blocks: Block[]
  onScrollTo: (blockId: string) => void
}

export function BlockIndex({ blocks, onScrollTo }: Props) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order)

  return (
    <div className="flex w-36 shrink-0 flex-col gap-0.5 overflow-y-auto border-r bg-muted/30 p-2">
      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Index
      </p>
      {sorted.map(block => (
        <button
          key={block.id}
          onClick={() => onScrollTo(block.id)}
          className={cn(
            'rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent',
            block.type === 'ai-analysis' && 'text-primary',
          )}
        >
          {block.type === 'ai-analysis' || block.type === 'qa-bank' ? '✦ ' : ''}
          {block.title || 'Untitled'}
        </button>
      ))}
      <p className="mt-auto border-t pt-2 text-[10px] text-muted-foreground px-2">
        {sorted.length} {sorted.length === 1 ? 'block' : 'blocks'}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Write the full notes panel**

```tsx
// src/app/dashboard/interview-prep/[id]/_components/notes-panel.tsx
'use client'

import { useRef, useTransition } from 'react'
import { cn } from '@/lib/utils'
import type { PrepNoteRow } from '@/modules/interview-prep/queries'
import type { Block } from '@/modules/interview-prep/schema'
import { createNote } from '@/modules/interview-prep/actions'
import { BlockIndex } from './block-index'
import { BlockEditor } from './block-editor'

type Props = {
  sessionId: string
  notes: PrepNoteRow[]
  activeNoteId: string
  onNoteChange: (id: string) => void
  activeNote: PrepNoteRow | undefined
}

export function NotesPanel({ sessionId, notes, activeNoteId, onNoteChange, activeNote }: Props) {
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [isPending, startTransition] = useTransition()

  const sorted = activeNote
    ? [...activeNote.sections].sort((a: Block, b: Block) => a.order - b.order)
    : []

  function scrollToBlock(blockId: string) {
    blockRefs.current[blockId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleAddNote() {
    startTransition(async () => {
      await createNote(sessionId, 'New doc')
    })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-r">
      {/* Note doc switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b bg-muted/30 px-3 py-2">
        {notes.map(note => (
          <button
            key={note.id}
            onClick={() => onNoteChange(note.id)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              note.id === activeNoteId
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-accent',
            )}
          >
            {note.title}
          </button>
        ))}
        <button
          onClick={handleAddNote}
          disabled={isPending}
          className="shrink-0 rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          + New doc
        </button>
      </div>

      {/* Index + blocks */}
      <div className="flex flex-1 overflow-hidden">
        <BlockIndex blocks={sorted} onScrollTo={scrollToBlock} />

        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-1 flex-col gap-3 p-4">
            {sorted.map(block => (
              <div key={block.id} ref={el => { blockRefs.current[block.id] = el }}>
                <BlockEditor
                  noteId={activeNote!.id}
                  block={block}
                  isFirst={block.order === 0}
                  isLast={block.order === sorted.length - 1}
                />
              </div>
            ))}
          </div>

          {/* Add block footer */}
          <div className="flex gap-2 border-t bg-muted/30 p-3">
            <AddTextBlockButton noteId={activeNote?.id ?? ''} />
          </div>
        </div>
      </div>
    </div>
  )
}

function AddTextBlockButton({ noteId }: { noteId: string }) {
  const [isPending, startTransition] = useTransition()
  const { addTextBlock } = require('@/modules/interview-prep/actions')

  function handleAdd() {
    if (!noteId) return
    startTransition(async () => { await addTextBlock(noteId) })
  }

  return (
    <button
      onClick={handleAdd}
      disabled={isPending || !noteId}
      className="rounded border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
    >
      + Text block
    </button>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Verify in browser**

Start dev server if not running. Load a session workspace. Verify: note switcher pills show, "+ New doc" creates a note, block index renders block titles.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/interview-prep/[id]/_components/notes-panel.tsx src/app/dashboard/interview-prep/[id]/_components/block-index.tsx
git commit -m "feat(interview-prep): add notes panel with switcher and block index"
```

---

## Task 11: Block editor component

**Files:**
- Create: `src/app/dashboard/interview-prep/[id]/_components/block-editor.tsx`

- [ ] **Step 1: Write the block editor**

```tsx
// src/app/dashboard/interview-prep/[id]/_components/block-editor.tsx
'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Block } from '@/modules/interview-prep/schema'
import {
  updateBlock, deleteBlock, moveBlockUp, moveBlockDown, convertAiBlockToText,
} from '@/modules/interview-prep/actions'

type Props = {
  noteId: string
  block: Block
  isFirst: boolean
  isLast: boolean
}

export function BlockEditor({ noteId, block, isFirst, isLast }: Props) {
  const [title, setTitle] = useState(block.title)
  const [content, setContent] = useState(block.content)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isAI = block.type === 'ai-analysis'
  const isQA = block.type === 'qa-bank'
  const isReadOnly = isAI || isQA

  function scheduleSave(updates: { title?: string; content?: string }) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      startTransition(async () => {
        await updateBlock(noteId, block.id, updates)
      })
    }, 800)
  }

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  function handleTitleChange(val: string) {
    setTitle(val)
    scheduleSave({ title: val })
  }

  function handleContentChange(val: string) {
    setContent(val)
    scheduleSave({ content: val })
  }

  function handleMoveUp() {
    startTransition(async () => { await moveBlockUp(noteId, block.id) })
  }

  function handleMoveDown() {
    startTransition(async () => { await moveBlockDown(noteId, block.id) })
  }

  function handleDelete() {
    setMenuOpen(false)
    startTransition(async () => { await deleteBlock(noteId, block.id) })
  }

  function handleConvert() {
    setMenuOpen(false)
    startTransition(async () => { await convertAiBlockToText(noteId, block.id) })
  }

  return (
    <div className={cn(
      'relative rounded-lg border overflow-hidden',
      isAI && 'border-l-2 border-l-primary',
      isPending && 'opacity-60',
    )}>
      {/* Block header */}
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
        <input
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          className="flex-1 bg-transparent text-xs font-medium outline-none placeholder:text-muted-foreground"
          placeholder="Block title"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={handleMoveUp}
            disabled={isFirst || isPending}
            className="rounded p-0.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-30"
            title="Move up"
          >↑</button>
          <button
            onClick={handleMoveDown}
            disabled={isLast || isPending}
            className="rounded p-0.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-30"
            title="Move down"
          >↓</button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="rounded p-0.5 text-xs text-muted-foreground hover:bg-accent"
              title="Block options"
            >⋯</button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 rounded-md border bg-popover py-1 shadow-md">
                {isAI && (
                  <button
                    onClick={handleConvert}
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    Convert to text block
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="block w-full px-3 py-1.5 text-left text-xs text-destructive hover:bg-accent"
                >
                  Delete block
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Block content */}
      <textarea
        value={content}
        onChange={e => handleContentChange(e.target.value)}
        readOnly={isReadOnly}
        rows={Math.max(4, content.split('\n').length + 1)}
        className={cn(
          'w-full resize-none bg-transparent p-3 font-mono text-sm outline-none',
          isReadOnly && 'cursor-default text-muted-foreground',
        )}
        placeholder={isReadOnly ? '' : 'Write your notes here (Markdown)…'}
      />
    </div>
  )
}
```

- [ ] **Step 2: Fix the dynamic require in notes-panel.tsx** — replace with static import

Open `src/app/dashboard/interview-prep/[id]/_components/notes-panel.tsx` and replace the `AddTextBlockButton` function:

```tsx
// Replace the dynamic require at the top of AddTextBlockButton:
// OLD:
//   const { addTextBlock } = require('@/modules/interview-prep/actions')
// NEW: add this import at the top of the file instead:
import { addTextBlock } from '@/modules/interview-prep/actions'

// And update AddTextBlockButton to use it directly (remove the require line inside the function)
function AddTextBlockButton({ noteId }: { noteId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    if (!noteId) return
    startTransition(async () => { await addTextBlock(noteId) })
  }

  return (
    <button
      onClick={handleAdd}
      disabled={isPending || !noteId}
      className="rounded border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
    >
      + Text block
    </button>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Verify in browser**

Load a session workspace. Verify: blocks render, title is editable, content textarea expands, ↑ ↓ reorder works, delete removes the block, save debounces correctly (check Network tab — request fires ~800ms after typing stops).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/interview-prep/[id]/_components/block-editor.tsx src/app/dashboard/interview-prep/[id]/_components/notes-panel.tsx
git commit -m "feat(interview-prep): add block editor with reorder, delete, and debounced save"
```

---

## Task 12: Documents tab UI

**Files:**
- Modify: `src/app/dashboard/interview-prep/[id]/_components/reference-panel.tsx`
- Create: `src/app/dashboard/interview-prep/[id]/_components/documents-tab.tsx`

- [ ] **Step 1: Write the documents tab**

```tsx
// src/app/dashboard/interview-prep/[id]/_components/documents-tab.tsx
'use client'

import { useState, useTransition, useRef } from 'react'
import type { PrepDocumentRow } from '@/modules/interview-prep/queries'
import { addDocument, deleteDocument } from '@/modules/interview-prep/actions'
import { extractPdfText } from '@/modules/profile-import/pdf'
import { cn } from '@/lib/utils'

type Props = {
  sessionId: string
  activeNoteId: string
  documents: PrepDocumentRow[]
}

export function DocumentsTab({ sessionId, activeNoteId, documents }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteName, setPasteName] = useState('')
  const [pasteContent, setPasteContent] = useState('')

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)

    if (file.type === 'application/pdf') {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const text = await extractPdfText(bytes)
      if (!text.trim()) {
        setUploadError('This PDF appears to be image-only — paste the text manually instead.')
        return
      }
      startTransition(async () => {
        await addDocument(sessionId, { name: file.name, docType: 'other', content: text })
      })
    } else if (file.type === 'text/plain') {
      const text = await file.text()
      startTransition(async () => {
        await addDocument(sessionId, { name: file.name, docType: 'other', content: text })
      })
    } else {
      setUploadError('Supported formats: PDF, TXT. For Word docs, copy and paste the text.')
    }

    if (fileRef.current) fileRef.current.value = ''
  }

  async function handlePasteSubmit() {
    if (!pasteName.trim() || !pasteContent.trim()) return
    startTransition(async () => {
      await addDocument(sessionId, { name: pasteName.trim(), docType: 'other', content: pasteContent.trim() })
      setPasteName('')
      setPasteContent('')
      setPasteMode(false)
    })
  }

  function handleDelete(docId: string) {
    startTransition(async () => { await deleteDocument(docId) })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.length === 0 && !pasteMode && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No documents yet. Upload an interview pack, company values doc, or any relevant material.
          </p>
        )}

        {documents.map(doc => (
          <div key={doc.id} className={cn('rounded-lg border p-3', doc.aiAnalysedAt && 'border-l-2 border-l-primary')}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{doc.name}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {doc.docType !== 'other' ? doc.docType : ''}
                  {doc.aiAnalysedAt ? ' · ✦ Analysed' : ''}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setExpandedId(v => v === doc.id ? null : doc.id)}
                  className="rounded px-2 py-0.5 text-[10px] border hover:bg-accent"
                >
                  {expandedId === doc.id ? 'Hide' : 'View'}
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={isPending}
                  className="rounded px-2 py-0.5 text-[10px] text-destructive border hover:bg-accent disabled:opacity-40"
                >
                  ✕
                </button>
              </div>
            </div>

            {expandedId === doc.id && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap">
                {doc.content}
              </div>
            )}

            {expandedId === doc.id && doc.aiAnalysis && (
              <div className="mt-2 rounded border-l-2 border-l-primary bg-muted/20 p-2 text-[11px] leading-relaxed">
                <p className="mb-1 text-[10px] font-semibold text-primary">✦ AI Insights</p>
                <div className="whitespace-pre-wrap">{String((doc.aiAnalysis as { content?: string })?.content ?? '')}</div>
              </div>
            )}
          </div>
        ))}

        {pasteMode && (
          <div className="rounded-lg border p-3 space-y-2">
            <input
              value={pasteName}
              onChange={e => setPasteName(e.target.value)}
              placeholder="Document name"
              className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1"
            />
            <textarea
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
              placeholder="Paste document text here…"
              rows={6}
              className="w-full resize-none rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1"
            />
            <div className="flex gap-2">
              <button
                onClick={handlePasteSubmit}
                disabled={isPending || !pasteName.trim() || !pasteContent.trim()}
                className="rounded bg-primary px-3 py-1 text-[10px] text-primary-foreground disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => setPasteMode(false)} className="rounded px-3 py-1 text-[10px] border hover:bg-accent">
                Cancel
              </button>
            </div>
          </div>
        )}

        {uploadError && (
          <p className="text-[10px] text-destructive">{uploadError}</p>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t p-3 space-y-2">
        <div className="flex gap-2">
          <label className="flex-1 cursor-pointer rounded border px-3 py-1.5 text-center text-xs hover:bg-accent">
            Upload PDF / TXT
            <input ref={fileRef} type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            onClick={() => setPasteMode(v => !v)}
            className="flex-1 rounded border px-3 py-1.5 text-xs hover:bg-accent"
          >
            Paste text
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build the real reference panel with tabs**

```tsx
// src/app/dashboard/interview-prep/[id]/_components/reference-panel.tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { PrepDocumentRow, PrepInterviewerRow } from '@/modules/interview-prep/queries'
import { DocumentsTab } from './documents-tab'
import { InterviewersTab } from './interviewers-tab'
import { QaTab } from './qa-tab'

type Tab = 'documents' | 'interviewers' | 'qa'

type Props = {
  sessionId: string
  activeNoteId: string
  documents: PrepDocumentRow[]
  interviewers: PrepInterviewerRow[]
}

export function ReferencePanel({ sessionId, activeNoteId, documents, interviewers }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('documents')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'documents', label: 'Documents' },
    { id: 'interviewers', label: 'Interviewers' },
    { id: 'qa', label: 'Q&A' },
  ]

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-hidden border-l bg-muted/10">
      {/* Tab bar */}
      <div className="flex border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 px-2 py-2.5 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'documents' && (
        <DocumentsTab sessionId={sessionId} activeNoteId={activeNoteId} documents={documents} />
      )}
      {activeTab === 'interviewers' && (
        <InterviewersTab sessionId={sessionId} activeNoteId={activeNoteId} interviewers={interviewers} />
      )}
      {activeTab === 'qa' && (
        <QaTab sessionId={sessionId} activeNoteId={activeNoteId} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create stubs for InterviewersTab and QaTab** (needed for reference-panel to typecheck)

```tsx
// src/app/dashboard/interview-prep/[id]/_components/interviewers-tab.tsx
'use client'
import type { PrepInterviewerRow } from '@/modules/interview-prep/queries'
type Props = { sessionId: string; activeNoteId: string; interviewers: PrepInterviewerRow[] }
export function InterviewersTab(_props: Props) {
  return <div className="p-4 text-xs text-muted-foreground">Interviewers tab coming in next task.</div>
}
```

```tsx
// src/app/dashboard/interview-prep/[id]/_components/qa-tab.tsx
'use client'
type Props = { sessionId: string; activeNoteId: string }
export function QaTab(_props: Props) {
  return <div className="p-4 text-xs text-muted-foreground">Q&A tab — AI analysis coming soon.</div>
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Verify in browser**

Load a session workspace. Verify: Documents tab shows, file upload works, paste mode works, uploaded docs appear in list with a View toggle, delete removes them.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/interview-prep/[id]/_components/
git commit -m "feat(interview-prep): add reference panel with documents tab"
```

---

## Task 13: Interviewers tab UI

**Files:**
- Modify: `src/app/dashboard/interview-prep/[id]/_components/interviewers-tab.tsx`

- [ ] **Step 1: Write the interviewers tab**

```tsx
// src/app/dashboard/interview-prep/[id]/_components/interviewers-tab.tsx
'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import type { PrepInterviewerRow } from '@/modules/interview-prep/queries'
import { addInterviewer, updateInterviewer, deleteInterviewer } from '@/modules/interview-prep/actions'

type Props = {
  sessionId: string
  activeNoteId: string
  interviewers: PrepInterviewerRow[]
}

export function InterviewersTab({ sessionId, activeNoteId, interviewers }: Props) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    if (!newName.trim()) return
    startTransition(async () => {
      await addInterviewer(sessionId, { name: newName.trim(), role: newRole.trim() || undefined })
      setNewName('')
      setNewRole('')
      setShowAddForm(false)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteInterviewer(id) })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {interviewers.length === 0 && !showAddForm && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Add interviewers to get AI-powered insights about who you'll be speaking with.
          </p>
        )}

        {interviewers.map(interviewer => (
          <InterviewerCard
            key={interviewer.id}
            interviewer={interviewer}
            expanded={expandedId === interviewer.id}
            onExpand={() => setExpandedId(v => v === interviewer.id ? null : interviewer.id)}
            onDelete={() => handleDelete(interviewer.id)}
            onUpdate={(field, value) => {
              startTransition(async () => { await updateInterviewer(interviewer.id, { [field]: value }) })
            }}
            isPending={isPending}
          />
        ))}

        {showAddForm && (
          <div className="rounded-lg border p-3 space-y-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Interviewer name"
              className="w-full rounded border bg-background px-2 py-1 text-xs outline-none"
              autoFocus
            />
            <input
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              placeholder="Role / title (optional)"
              className="w-full rounded border bg-background px-2 py-1 text-xs outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={isPending || !newName.trim()}
                className="rounded bg-primary px-3 py-1 text-[10px] text-primary-foreground disabled:opacity-50"
              >
                Add
              </button>
              <button onClick={() => setShowAddForm(false)} className="rounded border px-3 py-1 text-[10px] hover:bg-accent">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-3">
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full rounded border px-3 py-1.5 text-xs hover:bg-accent"
        >
          + Add interviewer
        </button>
      </div>
    </div>
  )
}

type CardProps = {
  interviewer: PrepInterviewerRow
  expanded: boolean
  onExpand: () => void
  onDelete: () => void
  onUpdate: (field: 'linkedInText' | 'notes', value: string) => void
  isPending: boolean
}

function InterviewerCard({ interviewer, expanded, onExpand, onDelete, onUpdate, isPending }: CardProps) {
  const [linkedIn, setLinkedIn] = useState(interviewer.linkedInText ?? '')
  const [notes, setNotes] = useState(interviewer.notes ?? '')

  return (
    <div className={cn('rounded-lg border p-3', interviewer.aiAnalysedAt && 'border-l-2 border-l-primary')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">{interviewer.name}</p>
          {interviewer.role && <p className="text-[10px] text-muted-foreground">{interviewer.role}</p>}
          {interviewer.aiAnalysedAt && <p className="text-[10px] text-primary">✦ Analysed</p>}
        </div>
        <div className="flex gap-1">
          <button onClick={onExpand} className="rounded border px-2 py-0.5 text-[10px] hover:bg-accent">
            {expanded ? 'Close' : 'Edit'}
          </button>
          <button onClick={onDelete} disabled={isPending} className="rounded border px-2 py-0.5 text-[10px] text-destructive hover:bg-accent disabled:opacity-40">
            ✕
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          <div>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">LinkedIn profile text</p>
            <textarea
              value={linkedIn}
              onChange={e => setLinkedIn(e.target.value)}
              onBlur={() => onUpdate('linkedInText', linkedIn)}
              placeholder="Paste the interviewer's LinkedIn profile text here…"
              rows={5}
              className="w-full resize-none rounded border bg-background px-2 py-1 text-xs outline-none"
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => onUpdate('notes', notes)}
              placeholder="Any other notes about this interviewer…"
              rows={3}
              className="w-full resize-none rounded border bg-background px-2 py-1 text-xs outline-none"
            />
          </div>

          {interviewer.aiAnalysis && (
            <div className="rounded border-l-2 border-l-primary bg-muted/20 p-2">
              <p className="mb-1 text-[10px] font-semibold text-primary">✦ AI Profile Analysis</p>
              <div className="whitespace-pre-wrap text-[11px] leading-relaxed">
                {String((interviewer.aiAnalysis as { content?: string })?.content ?? '')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Verify in browser**

Load a session workspace. Open Interviewers tab. Verify: add form works, interviewer card appears, LinkedIn text saves on blur, delete works.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/interview-prep/[id]/_components/interviewers-tab.tsx
git commit -m "feat(interview-prep): add interviewers tab UI"
```

---

## Task 14: AI buttons + Q&A tab + usage labels + nav link

**Files:**
- Modify: `src/app/dashboard/interview-prep/[id]/_components/documents-tab.tsx` (add ✦ Analyse button)
- Modify: `src/app/dashboard/interview-prep/[id]/_components/interviewers-tab.tsx` (add ✦ Analyse button)
- Modify: `src/app/dashboard/interview-prep/[id]/_components/qa-tab.tsx` (implement placeholder)
- Modify: `src/app/dashboard/settings/usage/_components/usage-log.tsx` (add feature labels)
- Modify: `src/lib/nav-menu.ts` (add nav link)

- [ ] **Step 1: Add ✦ Analyse button to documents tab**

In `documents-tab.tsx`, add an import for `analyseDocument` and `analyseAllDocuments` from ai-actions, and wire up an Analyse button per document and a bulk button in the footer:

```tsx
// Add to imports in documents-tab.tsx:
import { analyseDocument, analyseAllDocuments } from '@/modules/interview-prep/ai-actions'

// Add a second useTransition for AI operations:
const [isAnalysing, startAnalyse] = useTransition()
const [aiError, setAiError] = useState<string | null>(null)

// Per-document analyse button (add alongside the View/delete buttons):
<button
  onClick={() => {
    setAiError(null)
    startAnalyse(async () => {
      const result = await analyseDocument(doc.id, activeNoteId)
      if (!result.ok) setAiError(result.message)
    })
  }}
  disabled={isAnalysing || !activeNoteId}
  className="rounded px-2 py-0.5 text-[10px] border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-40"
>
  {isAnalysing ? '…' : '✦ Analyse'}
</button>

// Bulk analyse button in footer (alongside upload/paste buttons):
<button
  onClick={() => {
    setAiError(null)
    startAnalyse(async () => {
      const result = await analyseAllDocuments(sessionId, activeNoteId)
      if (!result.ok) setAiError(result.message)
    })
  }}
  disabled={isAnalysing || !activeNoteId || documents.length === 0}
  className="w-full rounded border border-primary/40 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-40"
>
  {isAnalysing ? 'Analysing…' : '✦ Analyse all documents'}
</button>

// Show AI error if present:
{aiError && <p className="text-[10px] text-destructive">{aiError}</p>}
```

- [ ] **Step 2: Add ✦ Analyse button to interviewers tab**

In `interviewers-tab.tsx`, add an Analyse button to `InterviewerCard`:

```tsx
// Add to imports in interviewers-tab.tsx:
import { analyseInterviewer } from '@/modules/interview-prep/ai-actions'

// Add to InterviewerCard props:
type CardProps = {
  // ... existing props
  activeNoteId: string
  onAnalyseError: (msg: string) => void
}

// Add inside expanded section of InterviewerCard (before the existing aiAnalysis display):
<AnalyseInterviewerButton
  interviewerId={interviewer.id}
  activeNoteId={activeNoteId}
  onError={onAnalyseError}
/>

// New sub-component:
function AnalyseInterviewerButton({
  interviewerId, activeNoteId, onError,
}: { interviewerId: string; activeNoteId: string; onError: (msg: string) => void }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      onClick={() => {
        startTransition(async () => {
          const result = await analyseInterviewer(interviewerId, activeNoteId)
          if (!result.ok) onError(result.message)
        })
      }}
      disabled={isPending || !activeNoteId}
      className="w-full rounded border border-primary/40 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-40"
    >
      {isPending ? 'Analysing…' : '✦ Analyse interviewer profile'}
    </button>
  )
}

// In InterviewersTab, track aiError state and thread activeNoteId + onAnalyseError through to cards.
```

- [ ] **Step 3: Implement the Q&A tab placeholder with generate button**

```tsx
// src/app/dashboard/interview-prep/[id]/_components/qa-tab.tsx
'use client'

import { useTransition, useState } from 'react'
import { insertAiBlock } from '@/modules/interview-prep/actions'
import { prisma } from '@/lib/db'

type Props = { sessionId: string; activeNoteId: string }

// Note: Q&A generation requires the full session context — this is a
// placeholder. Full AI Q&A generation is a future enhancement.
export function QaTab({ sessionId, activeNoteId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-xs text-muted-foreground">
        Generate a question bank based on the job, your documents, and interviewer profiles. Questions are organised by interview stage.
      </p>
      <button
        disabled={isPending || !activeNoteId || done}
        className="rounded border border-primary/40 px-4 py-2 text-xs text-primary hover:bg-primary/10 disabled:opacity-40"
      >
        {isPending ? 'Generating…' : done ? '✓ Added to notes' : '✦ Generate Q&A bank'}
      </button>
      <p className="text-[10px] text-muted-foreground">
        Full AI Q&A generation coming in the next phase.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Add feature labels to usage log**

In `src/app/dashboard/settings/usage/_components/usage-log.tsx`, add to `FEATURE_LABELS`:

```ts
'interview-prep-doc-analysis':          'Interview prep — analyse document',
'interview-prep-interviewer-analysis':  'Interview prep — analyse interviewer',
'interview-prep-bulk-analysis':         'Interview prep — analyse all documents',
'interview-prep-qa-generation':         'Interview prep — generate Q&A',
```

- [ ] **Step 5: Add nav link**

In `src/lib/nav-menu.ts`, add the import and entry:

```ts
import {
  ClipboardList,
  Compass,
  FileText,
  HomeIcon,
  Mail,
  MessageSquare,  // add this
  UserRound,
  type LucideIcon
} from "lucide-react"

// Add to mainNav array after Cover Letters:
{ destination: "/dashboard/interview-prep", label: "Interview Prep", Icon: MessageSquare },
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 7: Full smoke test in browser**

Start dev server. Go through the full flow:
1. Create a new prep session from `/dashboard/interview-prep/new`
2. Verify it appears in the session list
3. Open the workspace — verify split panel loads
4. Add a text block — type in it — verify debounced save
5. Upload a document (paste mode) — verify it appears
6. Add an interviewer — verify card appears
7. Click ✦ Analyse on a document (requires LLM key in settings) — verify AI block appears in notes
8. Verify Interview Prep appears in sidebar nav

- [ ] **Step 8: Run full test suite**

```bash
npx vitest run src/modules/interview-prep/
```

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/dashboard/interview-prep/ src/lib/nav-menu.ts src/app/dashboard/settings/usage/_components/usage-log.tsx
git commit -m "feat(interview-prep): wire AI actions, Q&A tab, usage labels, nav link"
```

---

## Done

The feature is complete when:
- [ ] All tests in `src/modules/interview-prep/` pass
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] The full smoke test in Task 14 Step 7 succeeds
- [ ] Interview Prep is visible in the sidebar nav
- [ ] AI features degrade gracefully when no LLM key is configured (existing `getLLMConfigStatus` gate in the LLM layer handles this)
