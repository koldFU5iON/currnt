# CV Generation Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "CV Generation" settings panel with a toggle that instructs the LLM to merge multiple roles at the same company into a single promotion-journey entry at generation time.

**Architecture:** A new boolean column on `UserSettings` (`mergeRepeatedEmployers`) is read in `generate.ts` alongside existing parallel DB loads; when true, a structured instruction block is injected into the LLM user message before generation fires. The preference is set via a new `/dashboard/settings/cv-generation` page following the exact pattern of `ai-writing`.

**Tech Stack:** Next.js 16 App Router, Prisma 7, shadcn/ui (`Switch`, `Label`), Server Actions, `sonner` toasts

## Global Constraints

- All schema changes via `npm run db:migrate -- --name <name>`, never `db:push`
- Business logic stays in `src/modules/`; settings pages are thin wrappers
- Server Actions must call `requireProfile()` before touching any DB
- `revalidatePath('/dashboard/settings/cv-generation')` after every mutation
- Follow existing `ai-writing` page structure exactly (server page → client form → server action)
- No LLM provider env vars — all calls go through the user's saved key via `complete()`

---

## File Map

| Status | File | Purpose |
|--------|------|---------|
| Modify | `prisma/schema/settings.prisma` | Add `mergeRepeatedEmployers Boolean @default(false)` |
| Create | `src/app/dashboard/settings/cv-generation/_actions.ts` | Server Action to persist the toggle |
| Create | `src/app/dashboard/settings/cv-generation/_components/cv-generation-form.tsx` | Client form with Switch |
| Create | `src/app/dashboard/settings/cv-generation/page.tsx` | Server page; loads setting and renders form |
| Modify | `src/app/dashboard/settings/page.tsx` | Add CV Generation card to SECTIONS |
| Modify | `src/modules/cv/generate.ts` | Read preference, inject merge instruction when true |

---

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema/settings.prisma`

**Interfaces:**
- Produces: `UserSettings.mergeRepeatedEmployers: boolean` — available to all Prisma queries after migration

- [ ] **Step 1: Add the field to the schema**

In `prisma/schema/settings.prisma`, insert the new line before `writingBrief`:

```prisma
  /// When true, the CV generation prompt instructs the LLM to merge multiple
  /// roles at the same company into a single entry showing the promotion journey.
  mergeRepeatedEmployers Boolean @default(false)
  writingBrief          String?
```

- [ ] **Step 2: Create and apply the migration**

```bash
npm run db:migrate -- --name add_merge_repeated_employers
```

Expected output ends with:
```
The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ XXXXXXXXXXXXXX_add_merge_repeated_employers/
    └─ migration.sql

Prisma schema loaded from prisma/schema
```

- [ ] **Step 3: Verify Prisma client regenerated cleanly**

```bash
npm run typecheck
```

Expected: no errors. If you see `Property 'mergeRepeatedEmployers' does not exist`, the client didn't regenerate — run `npx prisma generate` manually.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema/settings.prisma prisma/migrations/
git commit -m "feat(settings): add mergeRepeatedEmployers to UserSettings"
```

---

### Task 2: Server Action

**Files:**
- Create: `src/app/dashboard/settings/cv-generation/_actions.ts`

**Interfaces:**
- Consumes: `requireProfile()` from `@/lib/session`, `prisma` from `@/lib/db`
- Produces: `updateCVGenerationSettings({ mergeRepeatedEmployers: boolean }): Promise<void>` — called by the client form

- [ ] **Step 1: Create the actions file**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'

export async function updateCVGenerationSettings(data: {
  mergeRepeatedEmployers: boolean
}): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.userSettings.update({
    where: { profileId: profile.id },
    data: { mergeRepeatedEmployers: data.mergeRepeatedEmployers },
  })
  revalidatePath('/dashboard/settings/cv-generation')
}
```

- [ ] **Step 2: Verify types compile**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/settings/cv-generation/_actions.ts
git commit -m "feat(settings): server action for CV generation preferences"
```

---

### Task 3: Settings page and form component

**Files:**
- Create: `src/app/dashboard/settings/cv-generation/_components/cv-generation-form.tsx`
- Create: `src/app/dashboard/settings/cv-generation/page.tsx`

**Interfaces:**
- Consumes: `updateCVGenerationSettings` from `../_actions`
- Consumes: `Switch` from `@/components/ui/switch`, `Label` from `@/components/ui/label`
- Consumes: `ContentContainer` from `@/app/components/ContentContainer`

- [ ] **Step 1: Create the client form component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { updateCVGenerationSettings } from '../_actions'

type Props = {
  initialMergeRepeatedEmployers: boolean
}

export function CVGenerationForm({ initialMergeRepeatedEmployers }: Props) {
  const [mergeRepeatedEmployers, setMergeRepeatedEmployers] = useState(
    initialMergeRepeatedEmployers,
  )
  const [isPending, startTransition] = useTransition()

  function handleToggle(checked: boolean) {
    setMergeRepeatedEmployers(checked)
    startTransition(async () => {
      try {
        await updateCVGenerationSettings({ mergeRepeatedEmployers: checked })
        toast.success('CV generation settings saved.')
      } catch {
        setMergeRepeatedEmployers(!checked)
        toast.error('Failed to save. Please try again.')
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-4">
        <Switch
          id="merge-employers"
          checked={mergeRepeatedEmployers}
          onCheckedChange={handleToggle}
          disabled={isPending}
        />
        <div className="space-y-1">
          <Label htmlFor="merge-employers" className="text-sm font-medium leading-none">
            Merge repeated employers
          </Label>
          <p className="text-xs text-muted-foreground">
            When you&apos;ve held multiple roles at the same company, the AI will produce one
            entry showing your full tenure and promotion journey rather than separate sections.
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the server page**

```tsx
import { ContentContainer } from '@/app/components/ContentContainer'
import { requireProfile } from '@/lib/session'
import { prisma } from '@/lib/db'
import { CVGenerationForm } from './_components/cv-generation-form'

export default async function Page() {
  const { profile } = await requireProfile()

  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { mergeRepeatedEmployers: true },
  })

  return (
    <ContentContainer
      title="CV Generation"
      description="Control how the AI structures and formats your generated CVs."
    >
      <CVGenerationForm
        initialMergeRepeatedEmployers={settings?.mergeRepeatedEmployers ?? false}
      />
    </ContentContainer>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/settings/cv-generation/
git commit -m "feat(settings): CV generation page and form component"
```

---

### Task 4: Add CV Generation to settings navigation

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

**Interfaces:**
- Consumes: `FileText` icon from `lucide-react` (add to existing import)

- [ ] **Step 1: Update the import line**

In `src/app/dashboard/settings/page.tsx`, add `FileText` to the lucide import:

```tsx
import { BarChart2, ChevronRight, FileText, KeyRound, LayoutGrid, PenLine, Sparkles, UserCircle } from 'lucide-react'
```

- [ ] **Step 2: Add the new SECTIONS entry**

Insert after the `ai-writing` entry (after the `PenLine` card):

```tsx
  {
    href: '/dashboard/settings/cv-generation',
    Icon: FileText,
    title: 'CV Generation',
    description: 'Control how the AI structures and formats your generated CVs.',
  },
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Smoke-test in browser**

Start the dev server (`npm run dev`), navigate to `/dashboard/settings`, and confirm the CV Generation card appears and links to `/dashboard/settings/cv-generation`. Toggle the switch on and off and confirm a success toast appears each time.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "feat(settings): add CV Generation to settings navigation"
```

---

### Task 5: Inject merge instruction into CV generation

**Files:**
- Modify: `src/modules/cv/generate.ts`

**Interfaces:**
- Consumes: `UserSettings.mergeRepeatedEmployers` via new parallel `prisma.userSettings.findUnique` call
- Produces: conditional `== CV GENERATION PREFERENCES ==` block in the LLM user message

- [ ] **Step 1: Add the DB read to the parallel Promise.all**

In `generate.ts`, extend the destructured array (currently 4 elements) to 5:

```ts
const [snapshot, { rules, brief }, cvPrompt, jobApp, cvGenSettings] = await Promise.all([
  buildProfileSnapshot(profileId),
  loadWritingContext(profileId),
  loadCVPrompt(),
  jobApplicationId
    ? prisma.jobApplication.findFirst({
        where: { id: jobApplicationId, profileId },
        select: { jobDescription: true, title: true, company: true, jobAnalysis: true },
      })
    : Promise.resolve(null),
  prisma.userSettings.findUnique({
    where: { profileId },
    select: { mergeRepeatedEmployers: true },
  }),
])
```

- [ ] **Step 2: Build the conditional instruction and inject it into the user message**

Add the `mergeInstruction` variable immediately before the `userMessage` array, then insert it into the array:

```ts
const mergeInstruction = cvGenSettings?.mergeRepeatedEmployers
  ? [
      '== CV GENERATION PREFERENCES ==',
      'Merge repeated employers: where the candidate held multiple roles at the same company, produce ONE experience section. Pack all role titles into the titles array ordered oldest → most recent. Span duration across the full tenure. Write one coherent description and merge all outcomes into a single outcomes list.',
    ].join('\n')
  : null

const userMessage = [
  jobContext,
  analysis ? formatAnalysisContext(analysis) : null,
  atsContext ? formatATSContext(atsContext) : null,
  mergeInstruction,
  '',
  '== CANDIDATE PROFILE ==',
  profileText,
  '',
  '== OUTPUT SCHEMA ==',
  SCHEMA_HINT,
].filter((p): p is string => p !== null).join('\n')
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors. The `filter((p): p is string => p !== null)` already handles the `null` case so no type changes needed.

- [ ] **Step 4: Manual end-to-end verification**

1. Sign in as `test@example.com` / `password`
2. Navigate to `/dashboard/settings/cv-generation` and enable "Merge repeated employers"
3. Generate a CV for a job application (or generic) where the profile has two roles at the same company
4. Confirm the generated CV has one experience entry for that company, with both titles in the titles array and a combined duration
5. Return to settings, disable the toggle, regenerate — confirm two separate entries appear

- [ ] **Step 5: Commit**

```bash
git add src/modules/cv/generate.ts
git commit -m "feat(cv): inject merge-employers instruction into generation prompt when enabled"
```

---

## Self-Review

**Spec coverage:**
- ✅ `mergeRepeatedEmployers` boolean in `UserSettings` — Task 1
- ✅ Server Action to persist it — Task 2
- ✅ Settings page + Switch toggle — Task 3
- ✅ Settings navigation card — Task 4
- ✅ Generation-time LLM instruction injection — Task 5
- ✅ Default off (no behaviour change for existing users) — covered by `@default(false)` in Task 1

**Placeholder scan:** No TBDs or vague steps — all code blocks are complete.

**Type consistency:** `mergeRepeatedEmployers` used identically across Tasks 1–5. `cvGenSettings` introduced in Task 5 Step 1 and consumed in Step 2.
