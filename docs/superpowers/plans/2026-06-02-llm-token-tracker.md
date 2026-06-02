# LLM Token Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a log of every LLM call (tokens, latency, feature label) and expose it as a usage dashboard + a footer stat showing tokens used today / this month.

**Architecture:** A new `LlmUsageLog` Prisma table is written fire-and-forget from `complete()` / `completeStructured()` in the LLM client. A lightweight `/api/usage/summary` route feeds the footer stat. A server-rendered settings page at `/dashboard/settings/usage` shows the per-user log and, for admin users, an aggregate breakdown by feature and provider. Admin is determined by `User.role = "admin"` — a new field seeded on the test user.

**Tech Stack:** Prisma 7, Next.js 16 App Router Server Components, Tailwind CSS v4, Vitest

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema/auth.prisma` | Modify — add `role String @default("user")` to User |
| `prisma/schema/usage.prisma` | Create — `LlmUsageLog` model |
| `prisma/schema/profile.prisma` | Modify — add `usageLogs LlmUsageLog[]` relation |
| `prisma/seed.ts` | Modify — set test user role to `"admin"` |
| `src/modules/llm/client.ts` | Modify — add `feature?` to options, fire-and-forget log |
| `src/modules/llm/client.test.ts` | Create — verify log is written on each call type |
| `src/modules/jobs/job-fit.ts` | Modify — add `feature: 'job-fit'` |
| `src/modules/jobs/extract-llm.ts` | Modify — add `feature: 'job-extract'` |
| `src/modules/profile-import/extract.ts` | Modify — add `feature: 'cv-import'` |
| `src/modules/profile/generate-summary.ts` | Modify — add `feature: 'profile-summary'` |
| `src/modules/profile/extract.ts` | Modify — add `feature: 'profile-extract'` |
| `src/lib/session.ts` | Modify — add `isAdminUser(userId)` helper |
| `src/modules/llm/usage.ts` | Create — `getUserUsageSummary`, `getAdminUsageSummary` |
| `src/app/api/usage/summary/route.ts` | Create — `GET /api/usage/summary` for footer |
| `src/components/shell/app-footer.tsx` | Modify — fetch + display token stat |
| `src/app/dashboard/settings/usage/page.tsx` | Create — usage settings page |
| `src/app/dashboard/settings/usage/_components/usage-log.tsx` | Create — user log table |
| `src/app/dashboard/settings/usage/_components/usage-admin.tsx` | Create — admin aggregate section |
| `src/app/dashboard/settings/page.tsx` | Modify — add "AI Usage" to SECTIONS |

---

## Task 1: Schema — LlmUsageLog + User.role + migration + seed

**Files:**
- Modify: `prisma/schema/auth.prisma`
- Create: `prisma/schema/usage.prisma`
- Modify: `prisma/schema/profile.prisma`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add `role` field to User in `prisma/schema/auth.prisma`**

Add after `image String?`:
```prisma
  role          String   @default("user")
```

Full User model becomes:
```prisma
model User {
  id            String   @id
  name          String
  email         String   @unique
  emailVerified Boolean  @default(false)
  image         String?
  role          String   @default("user")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sessions Session[]
  accounts Account[]
  profile  Profile?

  @@map("user")
}
```

- [ ] **Step 2: Create `prisma/schema/usage.prisma`**

```prisma
// ------------------------------------------------------------
// LLM USAGE LOGGING
// ------------------------------------------------------------

model LlmUsageLog {
  id               String   @id @default(cuid())
  profileId        String
  provider         String
  model            String
  feature          String?
  promptTokens     Int
  completionTokens Int
  totalTokens      Int
  latencyMs        Int
  createdAt        DateTime @default(now())

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@index([profileId, createdAt])
}
```

- [ ] **Step 3: Add relation to Profile in `prisma/schema/profile.prisma`**

Find the Profile model and add `usageLogs LlmUsageLog[]` to its relations block (alongside `experiences`, `skills`, etc.). The exact existing relations end is visible in the file — add after the last relation line before the `@@index` block.

- [ ] **Step 4: Run migration**

```bash
npm run db:migrate -- --name add-llm-usage-log
```

Expected: migration file created in `prisma/migrations/`, schema types regenerated.

- [ ] **Step 5: Update seed to set test user as admin**

In `prisma/seed.ts`, after the block that checks `existingUser` and creates them, add:

```ts
  await prisma.user.update({
    where: { email: TEST_EMAIL },
    data: { role: 'admin' },
  })
  console.log(`Set ${TEST_EMAIL} as admin`)
```

- [ ] **Step 6: Verify migration and seed**

```bash
npm run db:reset
```

Expected: clean DB, seed logs "Set test@example.com as admin".

Check:
```bash
npm run db:studio
```

Open the `user` table — confirm `role = "admin"` for the test user.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema/auth.prisma prisma/schema/usage.prisma prisma/schema/profile.prisma prisma/seed.ts prisma/migrations/
git commit -m "feat(usage): add LlmUsageLog schema + User.role field"
```

---

## Task 2: LLM client — fire-and-forget logging + tests

**Files:**
- Modify: `src/modules/llm/client.ts`
- Create: `src/modules/llm/client.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/modules/llm/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    userSettings: { findUnique: vi.fn() },
    llmUsageLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/lib/encryption', () => ({ decrypt: vi.fn().mockReturnValue('sk-test') }))

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: 'hello',
    finishReason: 'stop',
    output: { name: 'Test' },
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  }),
  Output: { object: vi.fn().mockReturnValue({}) },
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn().mockReturnValue(() => 'mock-model'),
}))
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockReturnValue(() => 'mock-model'),
}))
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn().mockReturnValue(() => 'mock-model'),
}))

import { complete, completeStructured } from './client'
import { prisma } from '@/lib/db'
import * as z from 'zod'

const mockFindUnique = vi.mocked(prisma.userSettings.findUnique)
const mockLogCreate = vi.mocked(prisma.llmUsageLog.create)

const fakeSettings = {
  llmProvider: 'anthropic',
  llmModel: 'claude-sonnet-4-6',
  llmApiKey: 'enc-key',
}

describe('complete() logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUnique.mockResolvedValue(fakeSettings as never)
    mockLogCreate.mockResolvedValue({} as never)
  })

  it('calls llmUsageLog.create after a successful complete()', async () => {
    await complete('profile-1', 'hello')
    // fire-and-forget: give microtasks a tick to flush
    await Promise.resolve()
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileId: 'profile-1',
          provider: 'anthropic',
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          feature: null,
        }),
      }),
    )
  })

  it('passes feature label through to the log', async () => {
    await complete('profile-1', 'hello', { feature: 'job-fit' })
    await Promise.resolve()
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ feature: 'job-fit' }),
      }),
    )
  })

  it('calls llmUsageLog.create after completeStructured()', async () => {
    const schema = z.object({ name: z.string() })
    await completeStructured('profile-1', 'hello', schema, { feature: 'cv-import' })
    await Promise.resolve()
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ feature: 'cv-import', totalTokens: 30 }),
      }),
    )
  })

  it('does not throw if log write fails', async () => {
    mockLogCreate.mockRejectedValueOnce(new Error('DB down'))
    await expect(complete('profile-1', 'hello')).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- client 2>&1 | tail -20
```

Expected: errors about missing `feature` in `CompleteOptions` or `llmUsageLog` not being called.

- [ ] **Step 3: Update `src/modules/llm/client.ts`**

Add `feature?: string` to `CompleteOptions`:

```ts
export type CompleteOptions = {
  model?: string
  system?: string
  maxOutputTokens?: number
  temperature?: number
  /** Label identifying which product feature made this call (e.g. 'job-fit', 'cv-import'). */
  feature?: string
}
```

Add a `logUsage` helper at the top of the file (after the imports), used from both functions:

```ts
function logUsage(
  profileId: string,
  provider: string,
  model: string,
  feature: string | undefined,
  usage: LanguageModelUsage,
  latencyMs: number,
): void {
  prisma.llmUsageLog.create({
    data: {
      profileId,
      provider,
      model,
      feature: feature ?? null,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      latencyMs,
    },
  }).catch(() => {}) // fire-and-forget: log failures never block the caller
}
```

In `complete()`, after building the return value and before `return`:
```ts
    logUsage(profileId, cfg.provider, modelId, opts.feature, result.usage, Date.now() - startedAt)
    return {
      text: result.text,
      finishReason: result.finishReason,
      provider: cfg.provider,
      model: modelId,
      usage: result.usage,
      latencyMs: Date.now() - startedAt,
    }
```

Note: compute `latencyMs` once before logging:
```ts
    const latencyMs = Date.now() - startedAt
    logUsage(profileId, cfg.provider, modelId, opts.feature, result.usage, latencyMs)
    return {
      text: result.text,
      finishReason: result.finishReason,
      provider: cfg.provider,
      model: modelId,
      usage: result.usage,
      latencyMs,
    }
```

Same pattern in `completeStructured()`:
```ts
    const latencyMs = Date.now() - startedAt
    logUsage(profileId, cfg.provider, modelId, opts.feature, result.usage, latencyMs)
    return {
      object: result.output as T,
      provider: cfg.provider,
      model: modelId,
      usage: result.usage,
      latencyMs,
    }
```

- [ ] **Step 4: Run tests — all should pass**

```bash
npm test -- client 2>&1 | tail -10
```

Expected: 4 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm test 2>&1 | tail -6
```

Expected: all test files pass.

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck 2>&1 | grep -i error | head -10
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/modules/llm/client.ts src/modules/llm/client.test.ts
git commit -m "feat(usage): add fire-and-forget LLM call logging to client"
```

---

## Task 3: Add feature labels to all 5 caller sites

**Files:**
- Modify: `src/modules/jobs/job-fit.ts`
- Modify: `src/modules/jobs/extract-llm.ts`
- Modify: `src/modules/profile-import/extract.ts`
- Modify: `src/modules/profile/generate-summary.ts`
- Modify: `src/modules/profile/extract.ts`

- [ ] **Step 1: `src/modules/jobs/job-fit.ts`**

Find the `completeStructured` call (currently around line 112). Add `feature: 'job-fit'` to the options object:

```ts
    const result = await completeStructured(profile.id, userPrompt, JobFitSchema, {
      system,
      maxOutputTokens: 700,
      temperature: 0.2,
      feature: 'job-fit',
    })
```

- [ ] **Step 2: `src/modules/jobs/extract-llm.ts`**

Find the `completeStructured` call. Add `feature: 'job-extract'`:

```ts
    const result = await completeStructured(profileId, prompt, ExtractedJobLLMSchema, {
      maxOutputTokens: 400,
      temperature: 0,
      feature: 'job-extract',
    })
```

- [ ] **Step 3: `src/modules/profile-import/extract.ts`**

Find the `completeStructured` call. Add `feature: 'cv-import'`:

```ts
    const result = await completeStructured(
      profile.id,
      `# CV text\n\n${text}\n\nExtract the structured profile as JSON matching the schema.`,
      ExtractedProfileSchema,
      { system: SYSTEM, temperature: 0.1, maxOutputTokens: 6000, feature: 'cv-import' },
    )
```

- [ ] **Step 4: `src/modules/profile/generate-summary.ts`**

Find the `complete` call and add `feature: 'profile-summary'`:

```ts
    const result = await complete(profile.id, userPrompt, {
      system: composeSystem(rules, brief, featureInstructions),
      maxOutputTokens: 300,
      temperature: 0.4,
      feature: 'profile-summary',
    })
```

- [ ] **Step 5: `src/modules/profile/extract.ts`**

Find the `completeStructured` call and add `feature: 'profile-extract'`:

```ts
        const result = await completeStructured(profile.id, prompt, ExtractedSuggestionsSchema, {
          system,
          maxOutputTokens: 1500,
          temperature: 0.2,
          feature: 'profile-extract',
        })
```

- [ ] **Step 6: Typecheck + full test run**

```bash
npm run typecheck 2>&1 | grep -i error | head -10
npm test 2>&1 | tail -6
```

Expected: no errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/modules/jobs/job-fit.ts src/modules/jobs/extract-llm.ts \
        src/modules/profile-import/extract.ts src/modules/profile/generate-summary.ts \
        src/modules/profile/extract.ts
git commit -m "feat(usage): label all LLM call sites with feature identifiers"
```

---

## Task 4: Usage queries + admin helper

**Files:**
- Create: `src/modules/llm/usage.ts`
- Modify: `src/lib/session.ts`

- [ ] **Step 1: Create `src/modules/llm/usage.ts`**

```ts
import { prisma } from '@/lib/db'

export type UserUsageSummary = {
  today: number
  thisMonth: number
  allTime: number
  totalCalls: number
  recentLogs: {
    id: string
    provider: string
    model: string
    feature: string | null
    promptTokens: number
    completionTokens: number
    totalTokens: number
    latencyMs: number
    createdAt: Date
  }[]
}

export type AdminUsageSummary = {
  thisMonthTokens: number
  thisMonthCalls: number
  byFeature: { feature: string | null; totalTokens: number; calls: number }[]
  byProvider: { provider: string; totalTokens: number; calls: number }[]
}

function startOfToday(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfMonth(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export async function getUserUsageSummary(profileId: string): Promise<UserUsageSummary> {
  const [today, thisMonth, allTime, recentLogs] = await Promise.all([
    prisma.llmUsageLog.aggregate({
      where: { profileId, createdAt: { gte: startOfToday() } },
      _sum: { totalTokens: true },
    }),
    prisma.llmUsageLog.aggregate({
      where: { profileId, createdAt: { gte: startOfMonth() } },
      _sum: { totalTokens: true },
    }),
    prisma.llmUsageLog.aggregate({
      where: { profileId },
      _sum: { totalTokens: true },
      _count: { id: true },
    }),
    prisma.llmUsageLog.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, provider: true, model: true, feature: true,
        promptTokens: true, completionTokens: true, totalTokens: true,
        latencyMs: true, createdAt: true,
      },
    }),
  ])

  return {
    today: today._sum.totalTokens ?? 0,
    thisMonth: thisMonth._sum.totalTokens ?? 0,
    allTime: allTime._sum.totalTokens ?? 0,
    totalCalls: allTime._count.id,
    recentLogs,
  }
}

export async function getAdminUsageSummary(): Promise<AdminUsageSummary> {
  const [monthly, byFeature, byProvider] = await Promise.all([
    prisma.llmUsageLog.aggregate({
      where: { createdAt: { gte: startOfMonth() } },
      _sum: { totalTokens: true },
      _count: { id: true },
    }),
    prisma.llmUsageLog.groupBy({
      by: ['feature'],
      _sum: { totalTokens: true },
      _count: { id: true },
      orderBy: { _sum: { totalTokens: 'desc' } },
    }),
    prisma.llmUsageLog.groupBy({
      by: ['provider'],
      _sum: { totalTokens: true },
      _count: { id: true },
      orderBy: { _sum: { totalTokens: 'desc' } },
    }),
  ])

  return {
    thisMonthTokens: monthly._sum.totalTokens ?? 0,
    thisMonthCalls: monthly._count.id,
    byFeature: byFeature.map(r => ({
      feature: r.feature,
      totalTokens: r._sum.totalTokens ?? 0,
      calls: r._count.id,
    })),
    byProvider: byProvider.map(r => ({
      provider: r.provider,
      totalTokens: r._sum.totalTokens ?? 0,
      calls: r._count.id,
    })),
  }
}
```

- [ ] **Step 2: Add `isAdminUser` to `src/lib/session.ts`**

Append to the existing file:

```ts
export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role === 'admin'
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep -i error | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/llm/usage.ts src/lib/session.ts
git commit -m "feat(usage): add usage query helpers and isAdminUser"
```

---

## Task 5: Footer token stat — API route + AppFooter

**Files:**
- Create: `src/app/api/usage/summary/route.ts`
- Modify: `src/components/shell/app-footer.tsx`

- [ ] **Step 1: Create `src/app/api/usage/summary/route.ts`**

```ts
import { requireProfile } from '@/lib/session'
import { getUserUsageSummary } from '@/modules/llm/usage'

export async function GET() {
  try {
    const { profile } = await requireProfile()
    const { today, thisMonth } = await getUserUsageSummary(profile.id)
    return Response.json({ today, thisMonth })
  } catch {
    return Response.json({ today: 0, thisMonth: 0 }, { status: 200 })
  }
}
```

The catch returns zeros rather than 401 — the footer stat is non-critical and shouldn't trigger an error state.

- [ ] **Step 2: Modify `src/components/shell/app-footer.tsx`**

Replace the entire file with:

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MessageSquareWarning, Settings } from "lucide-react"

import { APP_VERSION } from "@/lib/version"
import { FeedbackDrawer } from "@/app/components/FeedbackDrawer"

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function AppFooter() {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [tokens, setTokens] = useState<{ today: number; thisMonth: number } | null>(null)

  useEffect(() => {
    fetch('/api/usage/summary', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setTokens(data) })
      .catch(() => {})
  }, [])

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between gap-4 border-t bg-background px-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          <span>Ready</span>
        </div>
        {tokens !== null && (
          <span className="tabular-nums text-muted-foreground/60">
            {formatTokens(tokens.today)} today · {formatTokens(tokens.thisMonth)} mo
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <Settings className="size-3.5" />
          <span className="hidden sm:inline">Settings</span>
        </Link>
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <MessageSquareWarning className="size-3.5" />
          <span className="hidden sm:inline">Report an issue</span>
        </button>
        <span className="font-mono tabular-nums">v{APP_VERSION}</span>
      </div>

      <FeedbackDrawer open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </footer>
  )
}
```

The stat only renders once the fetch resolves — no loading skeleton needed since it's a low-priority detail.

- [ ] **Step 3: Typecheck + tests**

```bash
npm run typecheck 2>&1 | grep -i error | head -10
npm test 2>&1 | tail -6
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/usage/summary/route.ts src/components/shell/app-footer.tsx
git commit -m "feat(usage): footer token stat + /api/usage/summary endpoint"
```

---

## Task 6: Usage settings page + settings nav entry

**Files:**
- Create: `src/app/dashboard/settings/usage/page.tsx`
- Create: `src/app/dashboard/settings/usage/_components/usage-log.tsx`
- Create: `src/app/dashboard/settings/usage/_components/usage-admin.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Create `src/app/dashboard/settings/usage/_components/usage-log.tsx`**

```tsx
import type { UserUsageSummary } from '@/modules/llm/usage'
import { formatDate } from '@/lib/utils'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

const FEATURE_LABELS: Record<string, string> = {
  'job-fit': 'Job fit',
  'job-extract': 'Job extract',
  'cv-import': 'CV import',
  'profile-summary': 'Profile summary',
  'profile-extract': 'Profile extract',
}

export function UsageLog({ stats }: { stats: UserUsageSummary }) {
  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Today', value: formatTokens(stats.today) },
          { label: 'This month', value: formatTokens(stats.thisMonth) },
          { label: 'All time', value: formatTokens(stats.allTime) },
          { label: 'Total calls', value: stats.totalCalls.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Log table */}
      {stats.recentLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No calls yet — use an AI feature to see usage here.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Feature</th>
                <th className="px-3 py-2 text-left font-medium">Model</th>
                <th className="px-3 py-2 text-right font-medium">In</th>
                <th className="px-3 py-2 text-right font-medium">Out</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">ms</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentLogs.map(log => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {log.feature ? (FEATURE_LABELS[log.feature] ?? log.feature) : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {log.provider}/{log.model}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {log.promptTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {log.completionTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                    {log.totalTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {log.latencyMs.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/dashboard/settings/usage/_components/usage-admin.tsx`**

```tsx
import type { AdminUsageSummary } from '@/modules/llm/usage'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function UsageAdmin({ stats }: { stats: AdminUsageSummary }) {
  return (
    <div className="mt-8 space-y-4 border-t pt-6">
      <h2 className="text-sm font-semibold">Admin — all users this month</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Tokens</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatTokens(stats.thisMonthTokens)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Calls</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{stats.thisMonthCalls.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">By feature</p>
          <table className="w-full text-sm">
            <tbody>
              {stats.byFeature.map(r => (
                <tr key={r.feature ?? 'unknown'} className="border-b last:border-0">
                  <td className="px-3 py-1.5 text-xs">{r.feature ?? 'unknown'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-xs text-muted-foreground">{formatTokens(r.totalTokens)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-xs text-muted-foreground">{r.calls} calls</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">By provider</p>
          <table className="w-full text-sm">
            <tbody>
              {stats.byProvider.map(r => (
                <tr key={r.provider} className="border-b last:border-0">
                  <td className="px-3 py-1.5 text-xs capitalize">{r.provider}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-xs text-muted-foreground">{formatTokens(r.totalTokens)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-xs text-muted-foreground">{r.calls} calls</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/dashboard/settings/usage/page.tsx`**

```tsx
import { ContentContainer } from '@/app/components/ContentContainer'
import { requireProfile, isAdminUser } from '@/lib/session'
import { getUserUsageSummary, getAdminUsageSummary } from '@/modules/llm/usage'
import { UsageLog } from './_components/usage-log'
import { UsageAdmin } from './_components/usage-admin'

export default async function Page() {
  const { session, profile } = await requireProfile()
  const [stats, admin] = await Promise.all([
    getUserUsageSummary(profile.id),
    isAdminUser(session.user.id).then(isAdmin => isAdmin ? getAdminUsageSummary() : null),
  ])

  return (
    <ContentContainer
      title="AI Usage"
      description="Token consumption across all AI features. Each call uses your own API key."
    >
      <UsageLog stats={stats} />
      {admin && <UsageAdmin stats={admin} />}
    </ContentContainer>
  )
}
```

- [ ] **Step 4: Add "AI Usage" to settings index in `src/app/dashboard/settings/page.tsx`**

Add import at top:
```tsx
import { BarChart2, ChevronRight, KeyRound, PenLine, Sparkles, UserCircle } from 'lucide-react'
```

Add to the `SECTIONS` array (after `api-tokens` entry):
```tsx
  {
    href: '/dashboard/settings/usage',
    Icon: BarChart2,
    title: 'AI Usage',
    description: 'Token consumption log across all AI features.',
  },
```

- [ ] **Step 5: Typecheck + full test suite**

```bash
npm run typecheck 2>&1 | grep -i error | head -10
npm test 2>&1 | tail -6
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/settings/usage/ src/app/dashboard/settings/page.tsx
git commit -m "feat(usage): add AI usage settings page with log table and admin aggregate"
```

---

## Verification

1. `npm run db:reset` — clean seed with admin role confirmed
2. `npm run dev` — start dev server
3. Trigger a job-fit assessment → navigate to `/dashboard/settings/usage` → call appears in the log
4. Footer shows "X today · Y mo" (initially zeros, updates after first call)
5. Log table shows provider/model/feature/tokens/latency
6. Logged in as test@example.com (admin): admin section visible below user table
7. `npm run typecheck` — clean
8. `npm test` — all pass
