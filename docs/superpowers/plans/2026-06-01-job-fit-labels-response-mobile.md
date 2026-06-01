# Job Fit: Label Rename, Markdown Response, Mobile Drawer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the job-fit scale to `unlikely | weak | stretch | good | excellent`, upgrade the LLM response to structured markdown with strengths/weaknesses bullets, add a transparency info icon, and swap the popover for a bottom drawer on mobile.

**Architecture:** Four files carry most of the work — `schema.ts` (Zod enum), `job-fit.ts` (LLM prompt), `job-application.ts` (TS type), and `job-fit.tsx` (all UI). A one-time SQL data migration renames old label values stored in the `jobFit` JSON column. The UI refactor extracts a shared `FitDetail` inner component used by both the popover (desktop) and drawer (mobile), driven by a CSS `max-sm:hidden` / `sm:hidden` split.

**Tech Stack:** Prisma 7 (raw SQL data migration), Zod, Vitest, React, Tailwind CSS v4, shadcn/ui Popover + Drawer (vaul), Base UI Tooltip, `react-markdown`

**Spec:** `docs/superpowers/specs/2026-06-01-job-fit-labels-response-mobile.md`

---

## Files touched

| File | Change |
|------|--------|
| `prisma/migrations/<timestamp>_rename_job_fit_labels/migration.sql` | Create — data migration SQL |
| `src/app/types/job-application.ts` | Modify — update `JobFit.label` union type |
| `src/modules/jobs/schema.ts` | Modify — update Zod enum + field descriptions |
| `src/modules/jobs/schema.test.ts` | Create — tests for new label enum |
| `src/modules/jobs/job-fit.ts` | Modify — update prompt calibration text + maxOutputTokens |
| `src/app/dashboard/job-applications/_components/job-fit.tsx` | Modify — FLAME_STYLES keys, FitDetail component, MarkdownProse, info icon, popover width, mobile drawer |

---

## Task 1: DB data migration — rename stored label values

**Files:**
- Create: `prisma/migrations/<timestamp>_rename_job_fit_labels/migration.sql`

- [ ] **Step 1: Create the migration directory and SQL file**

```bash
MIGRATION_DIR="prisma/migrations/$(date +%Y%m%d%H%M%S)_rename_job_fit_labels"
mkdir -p "$MIGRATION_DIR"
cat > "$MIGRATION_DIR/migration.sql" << 'EOF'
-- Data migration: rename job-fit label values from the old scale to the new one.
-- 'poor' (0-2) becomes 'unlikely'; 'ok' (3-4) becomes 'weak'.
-- jobFit is a jsonb column so we use jsonb_set to update in place.

UPDATE "JobApplication"
SET "jobFit" = jsonb_set("jobFit"::jsonb, '{label}', '"unlikely"')
WHERE "jobFit" IS NOT NULL AND "jobFit"->>'label' = 'poor';

UPDATE "JobApplication"
SET "jobFit" = jsonb_set("jobFit"::jsonb, '{label}', '"weak"')
WHERE "jobFit" IS NOT NULL AND "jobFit"->>'label' = 'ok';
EOF
```

- [ ] **Step 2: Apply the migration**

```bash
npm run db:migrate
```

When prompted for a migration name, enter: `rename_job_fit_labels`

Expected output: `✔ Generated Prisma Client` and `The following migration(s) have been applied`.

- [ ] **Step 3: Verify (optional)**

```bash
npm run db:studio
```

Open `JobApplication` table in Prisma Studio and confirm no rows have `jobFit.label` equal to `"poor"` or `"ok"`.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/
git commit -m "chore: data migration — rename job-fit labels poor→unlikely, ok→weak"
```

---

## Task 2: Update TypeScript types, Zod schema, display styles, and tests

**Files:**
- Modify: `src/app/types/job-application.ts:76`
- Modify: `src/modules/jobs/schema.ts:31-38`
- Modify: `src/app/dashboard/job-applications/_components/job-fit.tsx:20-34`
- Create: `src/modules/jobs/schema.test.ts`

- [ ] **Step 1: Update the `JobFit` type in `src/app/types/job-application.ts`**

Replace line 77:
```ts
  label: "poor" | "ok" | "stretch" | "good" | "excellent"
```
With:
```ts
  label: "unlikely" | "weak" | "stretch" | "good" | "excellent"
```

- [ ] **Step 2: Update the Zod schema in `src/modules/jobs/schema.ts`**

Replace lines 31–38:
```ts
export const JobFitSchema = z.object({
  rating: z.number().min(0).max(10).describe('Overall fit score, 0 = no match, 10 = perfect match.'),
  label: z.enum(['unlikely', 'weak', 'stretch', 'good', 'excellent'])
    .describe('Bucketed verdict. "unlikely" = rejected at first screen; "weak" = needs exceptional pitch; "stretch" = viable with effort; "good" = strong baseline match.'),
  justification: z.string().min(1)
    .describe('Markdown with **Strengths:** and **Weaknesses:** sections (2–3 bullets each), then one sentence overall summary. Concrete reasoning grounded in candidate and role specifics, no fluff.'),
  trajectoryNote: z.string().optional()
    .describe("One or two sentences on how this role relates to the candidate's stated career goals and target direction. Omit entirely when no career goals are provided."),
  notesUsed: z.boolean().optional()
    .describe('Set to true when personal notes were included in this assessment. Omit or set false otherwise.'),
})
```

- [ ] **Step 3: Update style record keys in `src/app/dashboard/job-applications/_components/job-fit.tsx`**

Replace lines 20–34:
```ts
const FLAME_STYLES: Record<JobFitType['label'], string> = {
  unlikely:  'fill-blue-400 text-blue-400',
  weak:      'fill-amber-200 text-amber-300',
  stretch:   'fill-amber-400 text-amber-500',
  good:      'fill-orange-500 text-orange-600',
  excellent: 'fill-red-500 text-red-600',
}

const PILL_TEXT_STYLES: Record<JobFitType['label'], string> = {
  unlikely:  'text-blue-400',
  weak:      'text-amber-300',
  stretch:   'text-amber-500',
  good:      'text-orange-600',
  excellent: 'text-red-600',
}
```

- [ ] **Step 4: Write the failing test in `src/modules/jobs/schema.test.ts`**

Create the file:
```ts
import { describe, it, expect } from "vitest"
import { JobFitSchema } from "./schema"

const base = { rating: 7, justification: "Strong match." }

describe("JobFitSchema label", () => {
  it.each(["unlikely", "weak", "stretch", "good", "excellent"])(
    "accepts '%s'",
    (label) => {
      expect(JobFitSchema.safeParse({ ...base, label }).success).toBe(true)
    },
  )

  it.each(["poor", "ok", "bad"])(
    "rejects old/invalid label '%s'",
    (label) => {
      expect(JobFitSchema.safeParse({ ...base, label }).success).toBe(false)
    },
  )
})
```

- [ ] **Step 5: Run the test to verify it fails (old enum values still in code)**

```bash
npm test -- src/modules/jobs/schema.test.ts
```

Expected: FAIL — the enum still has the old values at this point if you haven't saved yet. If you've already saved Step 2, run it now and expect PASS — that's fine, proceed.

- [ ] **Step 6: Run typecheck to verify no type errors**

```bash
npm run typecheck
```

Expected: no errors. The `Record<JobFitType['label'], string>` keys now match the updated type.

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all pass including the new `schema.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/app/types/job-application.ts src/modules/jobs/schema.ts src/modules/jobs/schema.test.ts src/app/dashboard/job-applications/_components/job-fit.tsx
git commit -m "feat: rename job-fit labels to unlikely/weak scale (#72)"
```

---

## Task 3: Update LLM prompt for new labels and markdown justification

**Files:**
- Modify: `src/modules/jobs/job-fit.ts:70-80,108,116`

- [ ] **Step 1: Update the prompt calibration text (lines 70–80)**

Replace the `featureInstructions` variable content. Find the block starting `const featureInstructions = \`You are an experienced career coach...` and update the calibration lines and `maxOutputTokens`:

The calibration section (currently lines 74–78) should read:
```
- 0–2 (unlikely): missing core requirements; would be rejected at first screen.
- 3–4 (weak): partial overlap; would need an exceptional cover letter to advance.
- 5–6 (stretch): meets most requirements but has a meaningful gap; viable with strong story.
- 7–8 (good): strong baseline match; can credibly compete in interviews.
- 9–10 (excellent): unusually well-aligned across role, level, and stack.
```

- [ ] **Step 2: Update the trailing prompt instruction (line 108)**

Replace:
```ts
  userPrompt += `\n\nReturn a single JSON object matching the schema. Two or three sentences in the justification${hasGoals ? '; one or two sentences in trajectoryNote' : ''}.`
```
With:
```ts
  userPrompt += `\n\nReturn a single JSON object matching the schema. In the justification, write markdown: a **Strengths:** section and a **Weaknesses:** section (2–3 bullet points each), then one sentence of overall summary.${hasGoals ? ' One or two sentences in trajectoryNote.' : ''}`
```

- [ ] **Step 3: Bump maxOutputTokens (line 116)**

Replace:
```ts
      maxOutputTokens: 600,
```
With:
```ts
      maxOutputTokens: 900,
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/jobs/job-fit.ts
git commit -m "feat: update job-fit prompt for markdown strengths/weaknesses response (#79)"
```

---

## Task 4: Refactor job-fit.tsx — FitDetail component, MarkdownProse, info icon, wider popover

**Files:**
- Modify: `src/app/dashboard/job-applications/_components/job-fit.tsx`

This task replaces the inline popover content with a shared `FitDetail` inner component, renders the justification as markdown, adds an info icon with tooltip, and widens the popover to `w-96`.

- [ ] **Step 1: Add new imports at the top of `job-fit.tsx`**

Replace the existing import block (lines 1–11) with:
```tsx
'use client'

import { useState, useTransition } from "react"
import { Flame, Info, Loader2, Puzzle, StickyNote } from "lucide-react"
import Link from "next/link"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { MarkdownProse } from "@/app/dashboard/job-applications/view/[id]/_components/markdown-prose"
import type { JobFit as JobFitType } from "@/app/types/job-application"
import { assessJobFit } from "@/modules/jobs/job-fit"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
```

- [ ] **Step 2: Replace the popover content section with FitDetail**

Replace lines 99–166 (the `return (` block that renders the `<Popover>`) with:

```tsx
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Fit: ${jobFit.label}, ${jobFit.rating} out of 10. Click for details.`}
        className="rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FitPill fit={jobFit} />
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <FitDetail
          jobFit={jobFit}
          hasLLMKey={hasLLMKey}
          canAssess={canAssess}
          onReassess={handleAssess}
        />
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 3: Add the FitDetail component after the closing `}` of JobFit**

Add this between the `JobFit` function closing brace and the `FitPill` function:

```tsx
type FitDetailProps = {
  jobFit: JobFitType
  hasLLMKey: boolean
  canAssess: boolean
  onReassess: () => void
}

function FitDetail({ jobFit, hasLLMKey, canAssess, onReassess }: FitDetailProps) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-sm font-semibold capitalize">{jobFit.label}</p>
          <span className="font-mono text-xs text-muted-foreground">{jobFit.rating}/10</span>
        </div>
        <MarkdownProse content={jobFit.justification} />
      </div>

      {jobFit.trajectoryNote && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-semibold mb-1.5">Your trajectory</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{jobFit.trajectoryNote}</p>
          </div>
        </>
      )}

      {jobFit.notesUsed && (
        <>
          <Separator />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StickyNote size={11} className="shrink-0 fill-amber-200 text-amber-500" />
            Personal notes were included when this assessment was run.
          </p>
        </>
      )}

      <Separator />

      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          AI assessments can be wrong — trust your gut.{' '}
          <Link href="/dashboard/career-profile" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Update your profile
          </Link>
        </p>
        <div className="shrink-0 flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="How fit is assessed"
                  className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  <Info size={11} />
                </button>
              }
            />
            <TooltipContent side="top">
              Fit is assessed by comparing your career profile (experience, skills,
              education) against the job description using an LLM. Your career goals
              and personal notes are included when available. Scores reflect
              real-world hiring bars — not a guarantee.
            </TooltipContent>
          </Tooltip>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReassess() }}
            disabled={!hasLLMKey || !canAssess}
            title={
              !hasLLMKey
                ? 'Add an LLM API key to re-assess'
                : !canAssess
                  ? 'Add a job description to re-assess'
                  : undefined
            }
            className={cn(
              "text-xs inline-flex items-center gap-1 transition-colors",
              (!hasLLMKey || !canAssess)
                ? "text-muted-foreground/40 cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Puzzle size={11} />
            Re-assess
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/job-applications/_components/job-fit.tsx
git commit -m "feat: job-fit popover — markdown justification, info icon, wider layout (#79)"
```

---

## Task 5: Mobile drawer — CSS-responsive split

**Files:**
- Modify: `src/app/dashboard/job-applications/_components/job-fit.tsx`

- [ ] **Step 1: Add Drawer imports**

In the import block at the top of `job-fit.tsx`, add after the Popover import line:
```tsx
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer"
```

- [ ] **Step 2: Replace the single Popover return with a desktop/mobile split**

Replace the `return (` block that currently renders `<Popover>...</Popover>` (added in Task 4) with:

```tsx
  return (
    <>
      {/* Desktop: popover — hidden below sm breakpoint */}
      <span className="max-sm:hidden">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            aria-label={`Fit: ${jobFit.label}, ${jobFit.rating} out of 10. Click for details.`}
            className="rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FitPill fit={jobFit} />
          </PopoverTrigger>
          <PopoverContent className="w-96">
            <FitDetail
              jobFit={jobFit}
              hasLLMKey={hasLLMKey}
              canAssess={canAssess}
              onReassess={handleAssess}
            />
          </PopoverContent>
        </Popover>
      </span>

      {/* Mobile: bottom drawer — hidden at sm and above */}
      <span className="sm:hidden">
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger
            aria-label={`Fit: ${jobFit.label}, ${jobFit.rating} out of 10. Tap for details.`}
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FitPill fit={jobFit} />
          </DrawerTrigger>
          <DrawerContent>
            <div className="px-4 pb-6 pt-2">
              <FitDetail
                jobFit={jobFit}
                hasLLMKey={hasLLMKey}
                canAssess={canAssess}
                onReassess={handleAssess}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </span>
    </>
  )
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Start the dev server and verify visually**

```bash
npm run dev
```

On desktop (≥640px): open `/dashboard/job-applications`, click a job-fit pill — popover should appear at `w-96`.

On mobile (use browser DevTools, set to ≤639px): click a fit pill — bottom drawer should slide up. Tap outside to dismiss. Tap Re-assess to re-run.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/job-applications/_components/job-fit.tsx
git commit -m "feat: job-fit mobile drawer — bottom sheet below sm breakpoint (#74)"
```
