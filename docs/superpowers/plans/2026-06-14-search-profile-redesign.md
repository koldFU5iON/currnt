# Search Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dual `onboardingContext` + `jobHuntSearch` stores with a single `searchProfile` that feeds both job board scanning and all LLM features, with a progressive suggestion queue surfaced on a new `/dashboard/search-context` page.

**Architecture:** A new `src/modules/search-profile/` module owns the Zod schema, queries, and server actions. All existing LLM consumers (job-fit, chat, cover-letter writing-guide) switch to reading from `searchProfile`. The job hunt scanner reads structured fields (roles, countries, salary) directly from `searchProfile`, removing the `SearchCriteriaBar` and `ScanSettingsDialog` from the job hunt page.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + PostgreSQL, Zod, shadcn/ui, nanoid, TypeScript strict

---

## File Map

### New files
- `src/modules/search-profile/schema.ts` — Zod schema, normalizers, hasContent helper
- `src/modules/search-profile/schema.test.ts` — unit tests for schema
- `src/modules/search-profile/queries.ts` — getSearchProfile, getSuggestionCount
- `src/modules/search-profile/actions.ts` — saveSearchProfile, emitSuggestion, acceptSuggestion, dismissSuggestion
- `src/modules/search-profile/actions.test.ts` — unit tests for actions
- `src/app/dashboard/search-context/page.tsx` — server page component
- `src/app/dashboard/search-context/_components/search-context-form.tsx` — client form
- `src/app/dashboard/search-context/_components/suggestions-panel.tsx` — inline suggestions panel

### Modified files
- `prisma/schema/settings.prisma` — add `searchProfile Json?` and `searchSuggestions Json?`
- `src/modules/llm/prompt-context.ts` — extend `WritingContext` with `searchProfileSummary`
- `src/modules/jobs/job-fit.ts` — switch to searchProfile, update prompt, add emitSuggestion
- `src/modules/chat/context.ts` — switch to normalizeSearchProfile
- `src/modules/chat/context.test.ts` — update mock to use searchProfile shape
- `src/modules/writing-guide/actions.ts` — pass searchProfileSummary to composeSystem, add emitSuggestion after Stage 1
- `src/modules/job-hunt/board-sources/queries.ts` — remove getJobHuntSearch, add getSearchCriteria reading from searchProfile
- `src/modules/job-hunt/actions.ts` — remove saveScanParameters
- `src/app/dashboard/job-hunt/page.tsx` — remove SearchCriteriaBar/ScanSettingsDialog, add "Edit search context" link
- `src/app/dashboard/layout.tsx` — fetch suggestionCount, pass to AppSidebar
- `src/components/app-sidebar.tsx` — accept suggestionCount prop, render badge on Search Context item
- `src/lib/nav-menu.ts` — update destination from `/dashboard/onboarding` to `/dashboard/search-context`
- `src/app/dashboard/page.tsx` — switch hasSignal to searchProfileHasContent
- `src/app/dashboard/onboarding/page.tsx` — replace with redirect to /dashboard/search-context

### Deleted files
- `src/app/dashboard/job-hunt/_components/search-criteria-bar.tsx`
- `src/app/dashboard/job-hunt/_components/scan-settings-dialog.tsx`

---

## Task 1: Prisma schema + data migration

**Files:**
- Modify: `prisma/schema/settings.prisma`
- Creates: `prisma/migrations/<timestamp>_add_search_profile/migration.sql` (generated then amended)

- [ ] **Step 1: Add fields to schema**

In `prisma/schema/settings.prisma`, add two fields after the `jobHuntSearch` line:

```prisma
  onboardingContext     Json?
  /// Universal search criteria for Job Hunt page. Shape: JobHuntSearchCriteria in src/modules/job-hunt/board-sources/schema.ts
  jobHuntSearch     Json?
  /// Unified search profile replacing onboardingContext + jobHuntSearch. Shape: SearchProfile in src/modules/search-profile/schema.ts
  searchProfile     Json?
  /// Pending context suggestions from AI features. Shape: SearchSuggestion[] in src/modules/search-profile/schema.ts
  searchSuggestions Json?
  /// Encrypted API keys for paid job board sources. Shape: { jsearch?: string }
  jobBoardApiKeys   Json?
```

- [ ] **Step 2: Generate migration**

```bash
npm run db:migrate -- --name add_search_profile
```

Expected: creates `prisma/migrations/<timestamp>_add_search_profile/migration.sql` with two `ALTER TABLE` statements.

- [ ] **Step 3: Append data migration SQL to the generated file**

Open the generated `migration.sql` and append this block after the `ALTER TABLE` statements:

```sql
-- Data migration: populate searchProfile from legacy onboardingContext + jobHuntSearch.
-- Runs once at deploy time. Idempotent — only updates rows where searchProfile IS NULL.
DO $$
DECLARE
  r RECORD;
  oc JSONB;
  jhs JSONB;
  target_role TEXT;
  additional_roles JSONB;
  combined_roles JSONB;
  industries TEXT;
  extra_ctx TEXT;
  career_goals TEXT;
  work_prefs TEXT;
  locations JSONB;
  min_salary NUMERIC;
  sp JSONB;
BEGIN
  FOR r IN
    SELECT id, "onboardingContext", "jobHuntSearch"
    FROM "UserSettings"
    WHERE "searchProfile" IS NULL
      AND ("onboardingContext" IS NOT NULL OR "jobHuntSearch" IS NOT NULL)
  LOOP
    oc  := COALESCE(r."onboardingContext"::jsonb, '{}'::jsonb);
    jhs := COALESCE(r."jobHuntSearch"::jsonb,     '{}'::jsonb);

    -- roles: targetRole first, then additionalRoles
    target_role      := COALESCE(NULLIF(TRIM(oc->>'targetRole'), ''), NULL);
    additional_roles := COALESCE(oc->'additionalRoles', '[]'::jsonb);
    IF target_role IS NOT NULL THEN
      combined_roles := jsonb_build_array(target_role) || additional_roles;
    ELSE
      combined_roles := additional_roles;
    END IF;

    -- careerGoals: industries prepended to extraContext
    industries := NULLIF(TRIM(oc->>'industries'), '');
    extra_ctx  := NULLIF(TRIM(oc->>'extraContext'), '');
    IF industries IS NOT NULL AND extra_ctx IS NOT NULL THEN
      career_goals := industries || E'\n' || extra_ctx;
    ELSE
      career_goals := COALESCE(industries, extra_ctx, '');
    END IF;

    -- extraContext: workPreferences
    work_prefs := COALESCE(NULLIF(TRIM(oc->>'workPreferences'), ''), '');

    -- countries from jobHuntSearch.locations
    locations := COALESCE(jhs->'locations', '[]'::jsonb);

    -- salaryBand.min from jobHuntSearch.minSalary
    BEGIN
      min_salary := (jhs->>'minSalary')::numeric;
    EXCEPTION WHEN others THEN
      min_salary := NULL;
    END;

    sp := jsonb_build_object(
      'preferredName',    COALESCE(oc->>'preferredName', ''),
      'currentRole',      COALESCE(oc->>'currentRole', ''),
      'roles',            combined_roles,
      'countries',        locations,
      'remotePreference', '',
      'salaryBand',       CASE WHEN min_salary IS NOT NULL
                          THEN jsonb_build_object('min', min_salary, 'max', NULL::numeric, 'currency', 'GBP')
                          ELSE NULL END,
      'careerGoals',      career_goals,
      'pivotContext',     '',
      'extraContext',     work_prefs
    );

    UPDATE "UserSettings" SET "searchProfile" = sp WHERE id = r.id;
  END LOOP;
END;
$$;
```

- [ ] **Step 4: Apply migration locally and verify**

```bash
npm run db:migrate
```

Expected: `All migrations have been successfully applied.`

Then verify in Prisma Studio (`npm run db:studio`) that the `UserSettings` table has `searchProfile` and `searchSuggestions` columns, and that any existing row has `searchProfile` populated.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema/settings.prisma prisma/migrations/
git commit -m "feat: add searchProfile and searchSuggestions to UserSettings"
```

---

## Task 2: `search-profile` module — schema

**Files:**
- Create: `src/modules/search-profile/schema.ts`
- Create: `src/modules/search-profile/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/search-profile/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  normalizeSearchProfile,
  searchProfileHasContent,
  normalizeSuggestions,
  emptySearchProfile,
} from './schema'

describe('normalizeSearchProfile', () => {
  it('returns empty defaults for null input', () => {
    expect(normalizeSearchProfile(null)).toEqual(emptySearchProfile)
  })

  it('returns empty defaults for invalid input', () => {
    expect(normalizeSearchProfile('not-an-object')).toEqual(emptySearchProfile)
  })

  it('parses a valid profile', () => {
    const raw = {
      preferredName: 'Devon',
      currentRole: 'Comms Ops',
      roles: ['Director of Operations'],
      countries: ['UK'],
      remotePreference: 'remote',
      salaryBand: { min: 80000, max: 120000, currency: 'GBP' },
      careerGoals: 'Want to lead ops at a mission-driven tech company',
      pivotContext: '',
      extraContext: '',
    }
    const result = normalizeSearchProfile(raw)
    expect(result.preferredName).toBe('Devon')
    expect(result.roles).toEqual(['Director of Operations'])
    expect(result.salaryBand?.min).toBe(80000)
    expect(result.remotePreference).toBe('remote')
  })

  it('defaults salaryBand to null when absent', () => {
    expect(normalizeSearchProfile({}).salaryBand).toBeNull()
  })

  it('defaults roles to empty array when absent', () => {
    expect(normalizeSearchProfile({}).roles).toEqual([])
  })

  it('rejects unknown remotePreference values', () => {
    const result = normalizeSearchProfile({ remotePreference: 'moonbase' })
    expect(result.remotePreference).toBe('')
  })
})

describe('searchProfileHasContent', () => {
  it('returns false for empty profile', () => {
    expect(searchProfileHasContent(emptySearchProfile)).toBe(false)
  })

  it('returns true when preferredName is set', () => {
    expect(searchProfileHasContent({ ...emptySearchProfile, preferredName: 'Devon' })).toBe(true)
  })

  it('returns true when roles is non-empty', () => {
    expect(searchProfileHasContent({ ...emptySearchProfile, roles: ['Head of Ops'] })).toBe(true)
  })

  it('returns true when salaryBand is set', () => {
    expect(
      searchProfileHasContent({ ...emptySearchProfile, salaryBand: { min: 80000, max: null, currency: 'GBP' } }),
    ).toBe(true)
  })
})

describe('normalizeSuggestions', () => {
  it('returns empty array for null', () => {
    expect(normalizeSuggestions(null)).toEqual([])
  })

  it('returns empty array for non-array', () => {
    expect(normalizeSuggestions('bad')).toEqual([])
  })

  it('filters out invalid entries', () => {
    const input = [
      { id: '1', field: 'roles', suggestedValue: ['DevRel'], reason: 'test', source: 'chat', createdAt: '2026-01-01T00:00:00Z' },
      { id: '2', field: 'INVALID_FIELD', suggestedValue: 'x', reason: 'r', source: 'chat', createdAt: '2026-01-01T00:00:00Z' },
    ]
    expect(normalizeSuggestions(input)).toHaveLength(1)
    expect(normalizeSuggestions(input)[0].id).toBe('1')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/search-profile/schema.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the schema**

Create `src/modules/search-profile/schema.ts`:

```typescript
import * as z from 'zod'

export const SalaryBandSchema = z.object({
  min: z.number().nullable().default(null),
  max: z.number().nullable().default(null),
  currency: z.string().default('GBP'),
})

export type SalaryBand = z.infer<typeof SalaryBandSchema>

export const SEARCH_PROFILE_FIELDS = [
  'preferredName', 'currentRole', 'roles', 'countries',
  'remotePreference', 'salaryBand', 'careerGoals', 'pivotContext', 'extraContext',
] as const

export type SearchProfileField = typeof SEARCH_PROFILE_FIELDS[number]

export const SearchProfileSchema = z.object({
  preferredName:    z.string().trim().max(120).default(''),
  currentRole:      z.string().trim().max(200).default(''),
  roles:            z.array(z.string().trim().max(100)).default([]),
  countries:        z.array(z.string().trim().max(100)).default([]),
  remotePreference: z.enum(['remote', 'hybrid', 'onsite', 'flexible', '']).default(''),
  salaryBand:       SalaryBandSchema.nullable().default(null),
  careerGoals:      z.string().trim().max(3000).default(''),
  pivotContext:     z.string().trim().max(3000).default(''),
  extraContext:     z.string().trim().max(3000).default(''),
})

export type SearchProfile = z.infer<typeof SearchProfileSchema>

export const SearchSuggestionSchema = z.object({
  id:             z.string(),
  field:          z.enum(SEARCH_PROFILE_FIELDS),
  suggestedValue: z.unknown(),
  reason:         z.string(),
  source:         z.enum(['job-fit', 'chat', 'cover-letter', 'interview-prep']),
  createdAt:      z.string(),
})

export type SearchSuggestion = z.infer<typeof SearchSuggestionSchema>

export const emptySearchProfile: SearchProfile = {
  preferredName: '', currentRole: '', roles: [], countries: [],
  remotePreference: '', salaryBand: null,
  careerGoals: '', pivotContext: '', extraContext: '',
}

export function normalizeSearchProfile(value: unknown): SearchProfile {
  const result = SearchProfileSchema.safeParse(value ?? {})
  return result.success ? result.data : { ...emptySearchProfile }
}

export function searchProfileHasContent(profile: SearchProfile): boolean {
  return (
    profile.preferredName.length > 0 ||
    profile.currentRole.length > 0 ||
    profile.roles.length > 0 ||
    profile.countries.length > 0 ||
    profile.remotePreference !== '' ||
    profile.salaryBand !== null ||
    profile.careerGoals.length > 0 ||
    profile.pivotContext.length > 0 ||
    profile.extraContext.length > 0
  )
}

export function normalizeSuggestions(value: unknown): SearchSuggestion[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => SearchSuggestionSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: SearchSuggestion }).data)
}

export function formatSalaryBand(band: SalaryBand): string {
  const symbol = band.currency === 'GBP' ? '£' : band.currency === 'EUR' ? '€' : '$'
  const min = band.min != null ? `${symbol}${band.min.toLocaleString()}` : null
  const max = band.max != null ? `${symbol}${band.max.toLocaleString()}` : null
  if (min && max) return `${min}–${max} ${band.currency}`
  if (min) return `${min}+ ${band.currency}`
  if (max) return `up to ${max} ${band.currency}`
  return band.currency
}

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/modules/search-profile/schema.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck 2>&1 | grep "search-profile/schema"
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/search-profile/schema.ts src/modules/search-profile/schema.test.ts
git commit -m "feat: add search-profile schema with normalizers and suggestion types"
```

---

## Task 3: `search-profile` module — queries and actions

**Files:**
- Create: `src/modules/search-profile/queries.ts`
- Create: `src/modules/search-profile/actions.ts`
- Create: `src/modules/search-profile/actions.test.ts`

- [ ] **Step 1: Write failing tests for actions**

Create `src/modules/search-profile/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: { userSettings: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() } } }))
vi.mock('@/lib/session', () => ({ requireProfile: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('nanoid', () => ({ nanoid: () => 'test-id-123' }))

import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { emitSuggestion, acceptSuggestion, dismissSuggestion } from './actions'

const mockProfile = { id: 'profile-1', name: 'Devon' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireProfile).mockResolvedValue({ profile: mockProfile } as never)
})

describe('emitSuggestion', () => {
  it('adds a new suggestion when queue is empty', async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({ searchSuggestions: null } as never)
    vi.mocked(prisma.userSettings.upsert).mockResolvedValue({} as never)

    await emitSuggestion('profile-1', {
      field: 'roles',
      suggestedValue: ['Head of DevRel'],
      reason: 'You explored DevRel paths in chat',
      source: 'chat',
    })

    expect(prisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          searchSuggestions: expect.arrayContaining([
            expect.objectContaining({ field: 'roles', source: 'chat', id: 'test-id-123' }),
          ]),
        }),
      }),
    )
  })

  it('skips if a pending suggestion for the same field already exists', async () => {
    const existing = [{
      id: 'existing-1', field: 'roles', suggestedValue: ['DevRel'],
      reason: 'earlier', source: 'job-fit', createdAt: '2026-01-01T00:00:00Z',
    }]
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({ searchSuggestions: existing } as never)

    await emitSuggestion('profile-1', {
      field: 'roles', suggestedValue: ['Head of DevRel'], reason: 'new', source: 'chat',
    })

    expect(prisma.userSettings.upsert).not.toHaveBeenCalled()
  })
})

describe('acceptSuggestion', () => {
  it('merges the suggestion value into searchProfile and removes it from the queue', async () => {
    const suggestion = {
      id: 'sugg-1', field: 'salaryBand',
      suggestedValue: { min: 90000, max: null, currency: 'GBP' },
      reason: 'noted in job fit', source: 'job-fit', createdAt: '2026-01-01T00:00:00Z',
    }
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      searchProfile: { preferredName: 'Devon', currentRole: '', roles: [], countries: [], remotePreference: '', salaryBand: null, careerGoals: '', pivotContext: '', extraContext: '' },
      searchSuggestions: [suggestion],
    } as never)
    vi.mocked(prisma.userSettings.update).mockResolvedValue({} as never)

    await acceptSuggestion('sugg-1')

    expect(prisma.userSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          searchProfile: expect.objectContaining({ salaryBand: { min: 90000, max: null, currency: 'GBP' } }),
          searchSuggestions: [],
        }),
      }),
    )
  })
})

describe('dismissSuggestion', () => {
  it('removes the suggestion without touching searchProfile', async () => {
    const suggestion = {
      id: 'sugg-2', field: 'roles', suggestedValue: ['DevRel'],
      reason: 'chat', source: 'chat', createdAt: '2026-01-01T00:00:00Z',
    }
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({ searchSuggestions: [suggestion] } as never)
    vi.mocked(prisma.userSettings.update).mockResolvedValue({} as never)

    await dismissSuggestion('sugg-2')

    expect(prisma.userSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { searchSuggestions: [] } }),
    )
  })
})
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
npx vitest run src/modules/search-profile/actions.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Write queries.ts**

Create `src/modules/search-profile/queries.ts`:

```typescript
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { normalizeSearchProfile, normalizeSuggestions } from './schema'

export async function getSearchProfile() {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { searchProfile: true, searchSuggestions: true },
  })
  return {
    profile,
    searchProfile: normalizeSearchProfile(settings?.searchProfile),
    suggestions: normalizeSuggestions(settings?.searchSuggestions),
  }
}

export async function getSuggestionCount(profileId: string): Promise<number> {
  const settings = await prisma.userSettings.findUnique({
    where: { profileId },
    select: { searchSuggestions: true },
  })
  return normalizeSuggestions(settings?.searchSuggestions).length
}
```

- [ ] **Step 4: Write actions.ts**

Create `src/modules/search-profile/actions.ts`:

```typescript
'use server'

import { nanoid } from 'nanoid'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import {
  normalizeSearchProfile,
  normalizeSuggestions,
  type SearchProfile,
  type SearchSuggestion,
} from './schema'

export async function saveSearchProfile(data: SearchProfile) {
  const { profile } = await requireProfile()
  await prisma.userSettings.upsert({
    where: { profileId: profile.id },
    create: { profileId: profile.id, searchProfile: data },
    update: { searchProfile: data },
  })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/search-context')
}

export async function emitSuggestion(
  profileId: string,
  suggestion: Omit<SearchSuggestion, 'id' | 'createdAt'>,
) {
  const settings = await prisma.userSettings.findUnique({
    where: { profileId },
    select: { searchSuggestions: true },
  })
  const existing = normalizeSuggestions(settings?.searchSuggestions)
  if (existing.some((s) => s.field === suggestion.field)) return

  const next: SearchSuggestion = { ...suggestion, id: nanoid(), createdAt: new Date().toISOString() }
  await prisma.userSettings.upsert({
    where: { profileId },
    create: { profileId, searchSuggestions: [...existing, next] },
    update: { searchSuggestions: [...existing, next] },
  })
  revalidatePath('/dashboard/search-context')
}

export async function acceptSuggestion(suggestionId: string) {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { searchProfile: true, searchSuggestions: true },
  })
  const suggestions = normalizeSuggestions(settings?.searchSuggestions)
  const suggestion = suggestions.find((s) => s.id === suggestionId)
  if (!suggestion) return

  const current = normalizeSearchProfile(settings?.searchProfile)
  const updated: SearchProfile = { ...current, [suggestion.field]: suggestion.suggestedValue }
  const remaining = suggestions.filter((s) => s.id !== suggestionId)

  await prisma.userSettings.update({
    where: { profileId: profile.id },
    data: { searchProfile: updated, searchSuggestions: remaining },
  })
  revalidatePath('/dashboard/search-context')
}

export async function dismissSuggestion(suggestionId: string) {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { searchSuggestions: true },
  })
  const remaining = normalizeSuggestions(settings?.searchSuggestions).filter(
    (s) => s.id !== suggestionId,
  )
  await prisma.userSettings.update({
    where: { profileId: profile.id },
    data: { searchSuggestions: remaining },
  })
  revalidatePath('/dashboard/search-context')
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/modules/search-profile/actions.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck 2>&1 | grep "search-profile"
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/modules/search-profile/queries.ts src/modules/search-profile/actions.ts src/modules/search-profile/actions.test.ts
git commit -m "feat: add search-profile queries and actions (save, emit/accept/dismiss suggestions)"
```

---

## Task 4: Search context page + form

**Files:**
- Create: `src/app/dashboard/search-context/page.tsx`
- Create: `src/app/dashboard/search-context/_components/search-context-form.tsx`

- [ ] **Step 1: Create the page server component**

Create `src/app/dashboard/search-context/page.tsx`:

```typescript
import { getSearchProfile } from '@/modules/search-profile/queries'
import { SearchContextForm } from './_components/search-context-form'

export default async function Page() {
  const { searchProfile, suggestions } = await getSearchProfile()

  return (
    <div className="max-w-3xl p-4 md:p-8">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Search context</p>
        <h1 className="text-3xl font-semibold tracking-tight">Tell the app who you are and what you&apos;re looking for</h1>
        <p className="text-muted-foreground">
          Used by job-fit scoring, the career coach, and job board scanning. Fill in what you know — the rest can come later.
        </p>
      </div>
      <SearchContextForm initialProfile={searchProfile} initialSuggestions={suggestions} />
    </div>
  )
}
```

- [ ] **Step 2: Create the form client component**

Create `src/app/dashboard/search-context/_components/search-context-form.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { LocationTagsInput } from '@/app/dashboard/job-hunt/_components/location-tags-input'
import { saveSearchProfile } from '@/modules/search-profile/actions'
import { SuggestionsPanel } from './suggestions-panel'
import type { SearchProfile, SearchSuggestion, SalaryBand } from '@/modules/search-profile/schema'

const REMOTE_OPTIONS = [
  { value: 'remote' as const,   label: 'Remote' },
  { value: 'hybrid' as const,   label: 'Hybrid' },
  { value: 'onsite' as const,   label: 'On-site' },
  { value: 'flexible' as const, label: 'Flexible' },
]

const CURRENCIES = ['GBP', 'USD', 'EUR', 'CAD', 'AUD']

type Props = {
  initialProfile: SearchProfile
  initialSuggestions: SearchSuggestion[]
}

export function SearchContextForm({ initialProfile, initialSuggestions }: Props) {
  const [profile, setProfile] = useState<SearchProfile>(initialProfile)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>(initialSuggestions)
  const [isPending, startTransition] = useTransition()

  function update<K extends keyof SearchProfile>(key: K, value: SearchProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }))
  }

  function handleSave() {
    startTransition(async () => {
      await saveSearchProfile(profile)
      toast.success('Search context saved')
    })
  }

  const salaryBand = profile.salaryBand ?? { min: null, max: null, currency: 'GBP' }

  function updateSalary(patch: Partial<SalaryBand>) {
    update('salaryBand', { ...salaryBand, ...patch })
  }

  function handleSalaryInput(field: 'min' | 'max', raw: string) {
    const stripped = raw.replace(/[^0-9]/g, '')
    const num = stripped ? Number(stripped) : null
    updateSalary({ [field]: num })
  }

  function onSuggestionAccepted(id: string, field: keyof SearchProfile, value: unknown) {
    setProfile((p) => ({ ...p, [field]: value }))
    setSuggestions((s) => s.filter((x) => x.id !== id))
  }

  function onSuggestionDismissed(id: string) {
    setSuggestions((s) => s.filter((x) => x.id !== id))
  }

  return (
    <div className="space-y-4">
      <SuggestionsPanel
        suggestions={suggestions}
        onAccepted={onSuggestionAccepted}
        onDismissed={onSuggestionDismissed}
      />

      {/* Identity */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="preferredName">Preferred name</Label>
          <Input
            id="preferredName"
            value={profile.preferredName}
            onChange={(e) => update('preferredName', e.target.value)}
            placeholder="What should the app call you?"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentRole">Current / last role</Label>
          <Input
            id="currentRole"
            value={profile.currentRole}
            onChange={(e) => update('currentRole', e.target.value)}
            placeholder="e.g. Communications Operations"
          />
        </div>
      </div>

      {/* Search parameters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Search parameters</CardTitle>
          <CardDescription className="text-xs">Used for job board scanning and AI features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Target roles</Label>
            <LocationTagsInput
              value={profile.roles}
              onChange={(roles) => update('roles', roles)}
              placeholder="e.g. Director of Operations — press Enter to add"
            />
            <p className="text-xs text-muted-foreground">First entry is your primary target role; extras are search aliases</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Countries</Label>
              <LocationTagsInput
                value={profile.countries}
                onChange={(countries) => update('countries', countries)}
                placeholder="e.g. UK, Ireland — press Enter"
              />
            </div>
            <div className="space-y-2">
              <Label>Remote preference</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {REMOTE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update('remotePreference', profile.remotePreference === opt.value ? '' : opt.value)}
                    className={cn(
                      'rounded-md border px-3 py-1 text-sm transition-colors',
                      profile.remotePreference === opt.value
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-input bg-background text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Salary band</Label>
            <div className="flex items-center gap-2">
              <select
                value={salaryBand.currency}
                onChange={(e) => updateSalary({ currency: e.target.value })}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Input
                className="w-32"
                value={salaryBand.min != null ? String(salaryBand.min) : ''}
                onChange={(e) => handleSalaryInput('min', e.target.value)}
                placeholder="Min"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                className="w-32"
                value={salaryBand.max != null ? String(salaryBand.max) : ''}
                onChange={(e) => handleSalaryInput('max', e.target.value)}
                placeholder="Max (optional)"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Career narrative */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Career narrative</CardTitle>
          <CardDescription className="text-xs">Used by AI features only — helps the coach understand your direction</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="careerGoals">Where you&apos;re heading</Label>
            <Textarea
              id="careerGoals"
              value={profile.careerGoals}
              onChange={(e) => update('careerGoals', e.target.value)}
              placeholder="Director-level ops at a mission-driven tech company. Open to dev ecosystem or SaaS roles…"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pivotContext">
              Career change context{' '}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="pivotContext"
              value={profile.pivotContext}
              onChange={(e) => update('pivotContext', e.target.value)}
              placeholder="Transitioning from agency comms into in-house tech ops. Strong background in…"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="extraContext">Anything else useful</Label>
            <Textarea
              id="extraContext"
              value={profile.extraContext}
              onChange={(e) => update('extraContext', e.target.value)}
              placeholder="Constraints, roles to avoid, visa requirements, things you often repeat when tailoring applications…"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save context'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep "search-context"
```

Expected: no errors.

- [ ] **Step 4: Run dev server and verify the page loads**

```bash
npm run dev
```

Navigate to `http://localhost:3000/dashboard/search-context`. Verify: the form renders with all three sections, the tag inputs work (type a role, press Enter), the remote preference pills toggle, the salary band inputs accept numbers.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/search-context/
git commit -m "feat: add search-context page with three-section form"
```

---

## Task 5: Suggestions panel component

**Files:**
- Create: `src/app/dashboard/search-context/_components/suggestions-panel.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/dashboard/search-context/_components/suggestions-panel.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { acceptSuggestion, dismissSuggestion } from '@/modules/search-profile/actions'
import { formatSalaryBand } from '@/modules/search-profile/schema'
import type { SearchSuggestion, SearchProfile, SalaryBand } from '@/modules/search-profile/schema'

type Props = {
  suggestions: SearchSuggestion[]
  onAccepted: (id: string, field: keyof SearchProfile, value: unknown) => void
  onDismissed: (id: string) => void
}

const SOURCE_LABELS: Record<SearchSuggestion['source'], string> = {
  'job-fit': 'job fit',
  'chat': 'chat',
  'cover-letter': 'cover letter',
  'interview-prep': 'interview prep',
}

function formatSuggestedValue(field: keyof SearchProfile, value: unknown): string {
  if (field === 'salaryBand' && value && typeof value === 'object') {
    return formatSalaryBand(value as SalaryBand)
  }
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'string') return value
  return String(value)
}

export function SuggestionsPanel({ suggestions, onAccepted, onDismissed }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [pending, startTransition] = useTransition()

  if (suggestions.length === 0) return null

  function handleAccept(suggestion: SearchSuggestion) {
    startTransition(async () => {
      await acceptSuggestion(suggestion.id)
      onAccepted(suggestion.id, suggestion.field, suggestion.suggestedValue)
    })
  }

  function handleDismiss(suggestion: SearchSuggestion) {
    startTransition(async () => {
      await dismissSuggestion(suggestion.id)
      onDismissed(suggestion.id)
    })
  }

  return (
    <div className="rounded-lg border border-l-4 border-l-violet-500 bg-card">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
          {suggestions.length}
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {suggestions.length === 1 ? '1 suggestion' : `${suggestions.length} suggestions`} from your recent activity
          </p>
          <p className="text-xs text-muted-foreground">Review and lock in what&apos;s useful</p>
        </div>
        {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t">
          {suggestions.map((suggestion, i) => (
            <div
              key={suggestion.id}
              className={`flex items-start gap-4 px-4 py-3 ${i < suggestions.length - 1 ? 'border-b' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium capitalize">
                    {suggestion.field.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {SOURCE_LABELS[suggestion.source]}
                  </Badge>
                </div>
                <p className="text-sm font-medium">
                  Add {formatSuggestedValue(suggestion.field, suggestion.suggestedValue)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{suggestion.reason}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0 mt-0.5">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  onClick={() => handleAccept(suggestion)}
                  disabled={pending}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleDismiss(suggestion)}
                  disabled={pending}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify panel works in browser**

```bash
npm run dev
```

Temporarily add a dummy suggestion to `getSearchProfile` in `queries.ts` to test the panel renders. Navigate to `/dashboard/search-context`. Verify: callout shows with count, clicking "Review" expands the panel, Accept/Dismiss buttons are present. Remove the dummy suggestion afterward.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/search-context/_components/suggestions-panel.tsx
git commit -m "feat: add inline suggestions panel on search-context page"
```

---

## Task 6: Nav update + sidebar badge

**Files:**
- Modify: `src/lib/nav-menu.ts`
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Update nav destination**

In `src/lib/nav-menu.ts`, change line 25:

```typescript
// Before:
{ destination: '/dashboard/onboarding', label: 'Search Context', Icon: Compass },

// After:
{ destination: '/dashboard/search-context', label: 'Search Context', Icon: Compass },
```

- [ ] **Step 2: Fetch suggestion count in dashboard layout**

In `src/app/dashboard/layout.tsx`, replace the current content with:

```typescript
import { AppSidebar } from '@/components/app-sidebar';
import { AppShell } from '@/components/shell/app-shell';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { PageContextProvider } from '@/lib/context/page-context';
import { requireProfile } from '@/lib/session';
import { getActiveJobsForNav } from '@/modules/jobs/queries';
import { getSuggestionCount } from '@/modules/search-profile/queries';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile()
  const [activeJobs, suggestionCount] = await Promise.all([
    getActiveJobsForNav(profile.id),
    getSuggestionCount(profile.id),
  ])

  return (
    <SidebarProvider>
      <PageContextProvider>
        <AppSidebar activeJobs={activeJobs} suggestionCount={suggestionCount} />
        <SidebarInset>
          <AppShell>{children}</AppShell>
        </SidebarInset>
      </PageContextProvider>
    </SidebarProvider>
  );
}
```

- [ ] **Step 3: Add badge to AppSidebar**

In `src/components/app-sidebar.tsx`:

1. Add `suggestionCount: number` to the `AppSidebar` props:

```typescript
// Before:
export function AppSidebar({ activeJobs }: { activeJobs: ActiveJobForNav[] }) {

// After:
export function AppSidebar({ activeJobs, suggestionCount }: { activeJobs: ActiveJobForNav[]; suggestionCount: number }) {
```

2. Pass `suggestionCount` down to where the nav items render. Find where `<NavMenuItem key={item.destination} {...item} />` is called and change it to:

```typescript
<NavMenuItem
  key={item.destination}
  {...item}
  badge={item.destination === '/dashboard/search-context' && suggestionCount > 0 ? suggestionCount : undefined}
/>
```

3. Find the `NavMenuItem` component definition (it will be later in `app-sidebar.tsx`) and add the `badge` prop. Look for the function signature and add `badge?: number`:

```typescript
// Find the NavMenuItem component and add badge support.
// The component renders a SidebarMenuButton with an icon and label.
// Add a small dot/count badge after the label when badge is provided.
// Example pattern — adjust to match the actual component structure:
function NavMenuItem({ destination, label, Icon, badge }: NavItem & { badge?: number }) {
  // ... existing implementation ...
  // Inside the SidebarMenuButton content, after the label:
  // {badge && badge > 0 && (
  //   <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold text-white">
  //     {badge}
  //   </span>
  // )}
}
```

Read the current `NavMenuItem` implementation carefully before editing — match the existing JSX structure exactly, only inserting the badge span.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck 2>&1 | grep -E "app-sidebar|nav-menu|layout"
```

Expected: no errors.

- [ ] **Step 5: Verify in browser**

Navigate to any dashboard page. Verify "Search Context" in the sidebar links to `/dashboard/search-context`. If there are suggestions, verify the violet badge appears.

- [ ] **Step 6: Commit**

```bash
git add src/lib/nav-menu.ts src/app/dashboard/layout.tsx src/components/app-sidebar.tsx
git commit -m "feat: update nav to /dashboard/search-context and add suggestion count badge"
```

---

## Task 7: Dashboard redirect + onboarding stub

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/onboarding/page.tsx`

- [ ] **Step 1: Update dashboard hasSignal check**

In `src/app/dashboard/page.tsx`, replace the `getOnboardingSettings` import and usage:

```typescript
// Remove:
import { getOnboardingSettings } from "@/modules/onboarding/queries"

// Add:
import { getSearchProfile } from "@/modules/search-profile/queries"
import { searchProfileHasContent } from "@/modules/search-profile/schema"
```

In the page component body, replace:

```typescript
// Remove:
const { profile, hasSignal, context } = await getOnboardingSettings()
if (!hasSignal) redirect("/dashboard/onboarding")
const displayName = context.preferredName || profile.name || "there"

// Add:
const { profile, searchProfile } = await getSearchProfile()
if (!searchProfileHasContent(searchProfile)) redirect("/dashboard/search-context")
const displayName = searchProfile.preferredName || profile.name || "there"
```

- [ ] **Step 2: Replace onboarding page with redirect**

Replace the entire content of `src/app/dashboard/onboarding/page.tsx` with:

```typescript
import { redirect } from 'next/navigation'

export default function Page() {
  redirect('/dashboard/search-context')
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep -E "dashboard/page|onboarding/page"
```

Expected: no errors.

- [ ] **Step 4: Verify redirect flow**

Clear the `searchProfile` column for the test user directly in Prisma Studio (`npm run db:studio`), then navigate to `http://localhost:3000/dashboard`. Verify it redirects to `/dashboard/search-context`. Fill in the form and save — verify it redirects back to `/dashboard` and shows your name.

Also verify that navigating to `/dashboard/onboarding` redirects to `/dashboard/search-context`.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/dashboard/onboarding/page.tsx
git commit -m "feat: redirect dashboard to search-context on first run, stub onboarding redirect"
```

---

## Task 8: Job-fit consumer update

**Files:**
- Modify: `src/modules/jobs/job-fit.ts`

- [ ] **Step 1: Swap onboarding imports for search-profile**

In `src/modules/jobs/job-fit.ts`, replace:

```typescript
// Remove:
import { normalizeOnboardingContext } from '@/modules/onboarding/schema'

// Add:
import { normalizeSearchProfile } from '@/modules/search-profile/schema'
import { emitSuggestion } from '@/modules/search-profile/actions'
```

- [ ] **Step 2: Update the settings fetch**

Find the `prisma.userSettings.findUnique` call (around line 57) and change:

```typescript
// Before:
select: { onboardingContext: true, writingBrief: true },

// After:
select: { searchProfile: true, writingBrief: true },
```

- [ ] **Step 3: Update the context normalization**

Find (around line 66) and replace:

```typescript
// Before:
const context = normalizeOnboardingContext(settings?.onboardingContext)
const hasGoals =
  !!(context.targetRole || context.industries || context.workPreferences || context.extraContext)

// After:
const context = normalizeSearchProfile(settings?.searchProfile)
const hasGoals = !!(
  context.roles.length > 0 ||
  context.careerGoals ||
  context.pivotContext ||
  context.extraContext ||
  context.remotePreference ||
  context.countries.length > 0 ||
  context.salaryBand
)
```

- [ ] **Step 4: Update the Career Goals prompt block**

Find the `if (hasGoals)` block that appends to `userPrompt` (around line 95) and replace:

```typescript
if (hasGoals) {
  userPrompt += '\n\n# Search context\n'
  if (context.roles.length > 0)     userPrompt += `\n**Target roles:** ${context.roles.join(', ')}`
  if (context.remotePreference)      userPrompt += `\n**Remote preference:** ${context.remotePreference}`
  if (context.countries.length > 0)  userPrompt += `\n**Countries:** ${context.countries.join(', ')}`
  if (context.salaryBand) {
    const { min, max, currency } = context.salaryBand
    const range = [min && `${currency} ${min.toLocaleString()}`, max && `${currency} ${max.toLocaleString()}`]
      .filter(Boolean).join('–')
    if (range) userPrompt += `\n**Salary band:** ${range}`
  }
  if (context.careerGoals)           userPrompt += `\n**Career goals:** ${context.careerGoals}`
  if (context.pivotContext)          userPrompt += `\n**Career change context:** ${context.pivotContext}`
  if (context.extraContext)          userPrompt += `\n**Additional context:** ${context.extraContext}`
}
```

- [ ] **Step 5: Update the system prompt instructions**

Find the `featureInstructions` string and update the `trajectoryNote` conditional text:

```typescript
// Before:
${hasGoals ? '\n\nWhen a # Career Goals section is provided, populate trajectoryNote...' : ''}

// After:
${hasGoals ? '\n\nWhen a # Search context section is provided, populate trajectoryNote with 1–2 sentences covering: (1) how the role aligns or diverges from the candidate\'s stated direction, (2) any location or remote-working mismatch, and (3) whether salary appears within band if visible in the JD. Omit the field entirely when no search context is provided.' : ''}
```

- [ ] **Step 6: Add emitSuggestion after scoring**

After the `fit = result.object` line and before the `prisma.jobApplication.update` call, add:

```typescript
  // Emit suggestion if job notes reveal a salary floor not yet in searchProfile
  if (hasNotes && !context.salaryBand && job.notes) {
    const salaryMatch = job.notes.match(/(?:not worth|minimum|below|less than)[^\d]*(\d[\d,]+)/i)
    if (salaryMatch) {
      const floor = Number(salaryMatch[1].replace(/,/g, ''))
      if (!isNaN(floor) && floor > 0) {
        await emitSuggestion(profile.id, {
          field: 'salaryBand',
          suggestedValue: { min: floor, max: null, currency: 'GBP' },
          reason: `You noted a salary floor around ${floor.toLocaleString()} while reviewing ${job.company ?? 'this role'}.`,
          source: 'job-fit',
        }).catch(() => { /* non-critical */ })
      }
    }
  }

  // Emit suggestion if job title is a new role type
  if (job.title && context.roles.length > 0) {
    const titleLower = job.title.toLowerCase()
    const alreadyTracked = context.roles.some((r) => titleLower.includes(r.toLowerCase()) || r.toLowerCase().includes(titleLower))
    if (!alreadyTracked) {
      await emitSuggestion(profile.id, {
        field: 'roles',
        suggestedValue: [...context.roles, job.title],
        reason: `You applied to "${job.title}" which isn't in your target roles list.`,
        source: 'job-fit',
      }).catch(() => { /* non-critical */ })
    }
  }
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck 2>&1 | grep "job-fit"
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/modules/jobs/job-fit.ts
git commit -m "feat: switch job-fit to searchProfile, update prompt, add emitSuggestion"
```

---

## Task 9: Chat consumer update

**Files:**
- Modify: `src/modules/chat/context.ts`
- Modify: `src/modules/chat/context.test.ts`

- [ ] **Step 1: Swap onboarding import**

In `src/modules/chat/context.ts`, replace:

```typescript
// Remove:
import { normalizeOnboardingContext } from '@/modules/onboarding/schema'

// Add:
import { normalizeSearchProfile } from '@/modules/search-profile/schema'
```

- [ ] **Step 2: Update buildProfileOverview select and normalization**

In `buildProfileOverview` (around line 51), change:

```typescript
// Before:
      settings: { select: { onboardingContext: true } },

// After:
      settings: { select: { searchProfile: true } },
```

And replace the normalization call and profile overview lines (around lines 80–92):

```typescript
// Before:
  const ctx = normalizeOnboardingContext(profile.settings?.onboardingContext)

  return [
    ...
    ctx.targetRole ? `Target role: ${ctx.targetRole}` : null,
    ctx.industries ? `Target industries: ${ctx.industries}` : null,
    ctx.workPreferences ? `Work preferences: ${ctx.workPreferences}` : null,
    ctx.extraContext ? `<user_context>${ctx.extraContext}</user_context>` : null,
  ]

// After:
  const ctx = normalizeSearchProfile(profile.settings?.searchProfile)

  return [
    `Name: ${profile.name}`,
    profile.headline ? `Headline: ${profile.headline}` : null,
    profile.location ? `Location: ${profile.location}` : null,
    currentRole ? `Most recent role: ${currentRole}` : null,
    topSkills ? `Top skills: ${topSkills}` : null,
    ctx.roles.length > 0   ? `Target roles: ${ctx.roles.join(', ')}` : null,
    ctx.countries.length > 0 ? `Countries: ${ctx.countries.join(', ')}` : null,
    ctx.remotePreference   ? `Remote preference: ${ctx.remotePreference}` : null,
    ctx.careerGoals        ? `Career goals: ${ctx.careerGoals}` : null,
    ctx.pivotContext       ? `Career change context: ${ctx.pivotContext}` : null,
    ctx.extraContext       ? `<user_context>${ctx.extraContext}</user_context>` : null,
  ]
    .filter(Boolean)
    .join('\n')
```

- [ ] **Step 3: Update the test mock**

In `src/modules/chat/context.test.ts`, find any mock that uses `onboardingContext` shape and replace with `searchProfile` shape:

```typescript
// Replace mock data shaped like onboardingContext:
// { onboardingContext: { targetRole: '...', ... } }
// with:
// { searchProfile: { roles: ['...'], careerGoals: '...', ... } }
```

Read the test file fully before editing to understand what's being mocked.

- [ ] **Step 4: Run existing chat context tests**

```bash
npx vitest run src/modules/chat/context.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck 2>&1 | grep "chat/context"
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/chat/context.ts src/modules/chat/context.test.ts
git commit -m "feat: switch chat context to searchProfile for richer coach awareness"
```

---

## Task 10: Cover letter consumer update

**Files:**
- Modify: `src/modules/llm/prompt-context.ts`
- Modify: `src/modules/writing-guide/actions.ts`

- [ ] **Step 1: Extend WritingContext with searchProfileSummary**

In `src/modules/llm/prompt-context.ts`, update the `WritingContext` type and `loadWritingContext`:

```typescript
import { normalizeSearchProfile } from '@/modules/search-profile/schema'

export type WritingContext = {
  rules: string
  brief: string | null
  searchProfileSummary: string | null
}

export async function loadWritingContext(profileId: string): Promise<WritingContext> {
  const [rules, settings] = await Promise.all([
    loadWritingRules().catch(() => ''),
    prisma.userSettings.findUnique({
      where: { profileId },
      select: { writingBrief: true, searchProfile: true },
    }),
  ])

  const sp = normalizeSearchProfile(settings?.searchProfile)
  const lines: string[] = []
  if (sp.roles.length > 0)    lines.push(`Target roles: ${sp.roles.join(', ')}`)
  if (sp.careerGoals)         lines.push(`Career goals: ${sp.careerGoals}`)
  if (sp.pivotContext)        lines.push(`Career change context: ${sp.pivotContext}`)
  if (sp.remotePreference)    lines.push(`Remote preference: ${sp.remotePreference}`)
  if (sp.countries.length > 0) lines.push(`Countries: ${sp.countries.join(', ')}`)

  return {
    rules,
    brief: settings?.writingBrief ?? null,
    searchProfileSummary: lines.length > 0 ? lines.join('\n') : null,
  }
}
```

- [ ] **Step 2: Pass searchProfileSummary into composeSystem in writing-guide**

In `src/modules/writing-guide/actions.ts`, there are ~7 calls to `composeSystem(writingCtx.rules, writingCtx.brief ?? '', ...)`. Update each one to also pass `writingCtx.searchProfileSummary`:

```typescript
// Before (every occurrence):
const system = composeSystem(writingCtx.rules, writingCtx.brief ?? '', stagePrompt)

// After (every occurrence):
const system = composeSystem(writingCtx.rules, writingCtx.brief, writingCtx.searchProfileSummary, stagePrompt)
```

Note: `composeSystem` accepts `...(string | null | undefined)[]` and already filters out falsy values — no other changes needed.

Similarly for `inputs.writingCtx.rules` / `inputs.writingCtx.brief` patterns — update each to include `inputs.writingCtx.searchProfileSummary`.

- [ ] **Step 3: Add emitSuggestion after Stage 1 analysis**

In `writing-guide/actions.ts`, find the function that runs Stage 1 (look for `feature: 'cover-letter-analyse'`). After a successful Stage 1 result, add:

```typescript
import { emitSuggestion } from '@/modules/search-profile/actions'
import { normalizeSearchProfile } from '@/modules/search-profile/schema'

// After Stage 1 succeeds and you have `letter.jobTitle` and the profile:
// (add this inside the stage 1 function, after the LLM call returns)
const spSettings = await prisma.userSettings.findUnique({
  where: { profileId },
  select: { searchProfile: true },
})
const sp = normalizeSearchProfile(spSettings?.searchProfile)
const jobTitle = letter.jobTitle ?? letter.jobApplication?.title
if (jobTitle && sp.roles.length > 0) {
  const titleLower = jobTitle.toLowerCase()
  const alreadyTracked = sp.roles.some(
    (r) => titleLower.includes(r.toLowerCase()) || r.toLowerCase().includes(titleLower),
  )
  if (!alreadyTracked) {
    await emitSuggestion(profileId, {
      field: 'roles',
      suggestedValue: [...sp.roles, jobTitle],
      reason: `You're writing a cover letter for "${jobTitle}" which isn't in your target roles.`,
      source: 'cover-letter',
    }).catch(() => { /* non-critical */ })
  }
}
```

Read the Stage 1 function carefully before editing to determine where `letter` and `profileId` are in scope.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck 2>&1 | grep -E "prompt-context|writing-guide"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/llm/prompt-context.ts src/modules/writing-guide/actions.ts
git commit -m "feat: add searchProfile context to cover letter writing pipeline"
```

---

## Task 11: Job hunt scanner update

**Files:**
- Modify: `src/modules/job-hunt/board-sources/queries.ts`
- Modify: `src/modules/job-hunt/actions.ts`
- Modify: `src/app/dashboard/job-hunt/page.tsx`
- Delete: `src/app/dashboard/job-hunt/_components/search-criteria-bar.tsx`
- Delete: `src/app/dashboard/job-hunt/_components/scan-settings-dialog.tsx`

- [ ] **Step 1: Replace getJobHuntSearch in board-sources/queries.ts**

In `src/modules/job-hunt/board-sources/queries.ts`, remove the `getJobHuntSearch` function entirely and add `getSearchCriteriaForScanner`:

```typescript
import { normalizeSearchProfile } from '@/modules/search-profile/schema'

export async function getSearchCriteriaForScanner() {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { searchProfile: true },
  })
  const sp = normalizeSearchProfile(settings?.searchProfile)
  return {
    profile,
    roles: sp.roles,
    countries: sp.countries,
    remotePreference: sp.remotePreference,
    minSalary: sp.salaryBand?.min ?? null,
  }
}
```

- [ ] **Step 2: Remove saveScanParameters from job-hunt/actions.ts**

In `src/modules/job-hunt/actions.ts`:
- Remove the `saveScanParameters` function (the block from `// ── saveScanParameters` to the closing `}`)
- Remove the `normalizeOnboardingContext` import if it's only used there

- [ ] **Step 3: Update job-hunt page**

Replace the content of `src/app/dashboard/job-hunt/page.tsx`:

```typescript
import Link from 'next/link'
import { ContentContainer } from '@/app/components/ContentContainer'
import { requireProfile } from '@/lib/session'
import { normalizeSearchProfile } from '@/modules/search-profile/schema'
import { getWatchlist, getDiscoveredJobs } from '@/modules/job-hunt/queries'
import { getBoardSources, getSearchCriteriaForScanner, getJobBoardKeyStatus } from '@/modules/job-hunt/board-sources/queries'
import { Watchlist } from './_components/watchlist'
import { DiscoveredJobs } from './_components/discovered-jobs'
import { JobBoardSources } from './_components/job-board-sources'
import { Settings2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export default async function JobHuntPage() {
  await requireProfile()

  const [watches, jobs, boardSources, criteria, keyStatus] = await Promise.all([
    getWatchlist(),
    getDiscoveredJobs(),
    getBoardSources(),
    getSearchCriteriaForScanner(),
    getJobBoardKeyStatus(),
  ])

  const availableProviders = new Set<string>([
    'remotive',
    'remoteok',
    ...(keyStatus.adzunaConfigured ? ['adzuna'] : []),
    ...(keyStatus.jSearchConfigured ? ['jsearch'] : []),
  ])

  const hasCriteria = criteria.roles.length > 0 || criteria.countries.length > 0

  return (
    <ContentContainer
      title="Job Hunt"
      description="Scan companies and job boards, then review matched roles."
      fullWidth
    >
      {/* Search criteria summary */}
      <div className="rounded-lg border bg-card px-4 py-3 mb-4 flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {criteria.roles.length > 0 && (
            <span><span className="text-muted-foreground text-xs uppercase tracking-wide mr-1.5">Roles</span>{criteria.roles.join(', ')}</span>
          )}
          {criteria.countries.length > 0 && (
            <span><span className="text-muted-foreground text-xs uppercase tracking-wide mr-1.5">Countries</span>{criteria.countries.join(', ')}</span>
          )}
          {criteria.remotePreference && (
            <span><span className="text-muted-foreground text-xs uppercase tracking-wide mr-1.5">Remote</span>{criteria.remotePreference}</span>
          )}
          {!hasCriteria && (
            <span className="text-muted-foreground text-sm">No search criteria set yet</span>
          )}
        </div>
        <Link
          href="/dashboard/search-context"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Settings2 className="size-3.5 mr-1.5" />
          Edit search context
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_280px_1fr] gap-6 items-start">
        <aside className="space-y-6 lg:sticky lg:top-6">
          <Watchlist watches={watches} />
        </aside>

        <aside className="lg:sticky lg:top-6">
          <JobBoardSources sources={boardSources} availableProviders={availableProviders} />
        </aside>

        <div className="min-w-0">
          <DiscoveredJobs jobs={jobs} />
        </div>
      </div>
    </ContentContainer>
  )
}
```

- [ ] **Step 4: Delete removed components**

```bash
rm src/app/dashboard/job-hunt/_components/search-criteria-bar.tsx
rm src/app/dashboard/job-hunt/_components/scan-settings-dialog.tsx
```

- [ ] **Step 5: Check for any remaining imports of deleted files**

```bash
grep -r "search-criteria-bar\|scan-settings-dialog\|SearchCriteriaBar\|ScanSettingsDialog\|saveScanParameters\|saveJobHuntSearch\|getJobHuntSearch" src/ --include="*.ts" --include="*.tsx"
```

Expected: no matches. Fix any that remain.

- [ ] **Step 6: Update job-hunt/actions.test.ts**

Remove any test for `saveScanParameters` and update mocks that reference `normalizeOnboardingContext`. Run:

```bash
npx vitest run src/modules/job-hunt/actions.test.ts
```

Fix until all pass.

- [ ] **Step 7: Full typecheck and build**

```bash
npm run typecheck
npm run build
```

Expected: both pass with no errors.

- [ ] **Step 8: Smoke test in browser**

```bash
npm run dev
```

Verify:
- `/dashboard/job-hunt` shows the read-only criteria summary and "Edit search context" link
- The link opens `/dashboard/search-context`
- Saving roles on search-context and returning to job-hunt shows the updated roles
- The company watchlist and job board scanning still work

- [ ] **Step 9: Commit**

```bash
git add src/modules/job-hunt/board-sources/queries.ts src/modules/job-hunt/actions.ts src/modules/job-hunt/actions.test.ts src/app/dashboard/job-hunt/page.tsx
git commit -m "feat: replace job hunt search bar with searchProfile criteria, remove ScanSettingsDialog"
```

---

## Final checks

- [ ] **Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Final commit if any lint/build fixes were needed**

```bash
git add -p
git commit -m "fix: resolve typecheck and build issues from search-profile migration"
```
