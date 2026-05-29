# Notes in Job-Fit Assessment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users optionally include their personal job note in the LLM job-fit assessment, with a checkbox in the notes popover and a "notes included" indicator in the fit popover.

**Architecture:** One new boolean field on `JobApplication` (`notesIncludeInFit`) is saved alongside the note text. `assessJobFit` reads the flag and injects a `# Personal Notes` block into the prompt. The LLM echoes back `notesUsed: true`; the fit popover renders a small amber indicator when that field is present.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + PostgreSQL, TypeScript strict, Zod, shadcn/ui, Lucide React

**Spec:** `docs/superpowers/specs/2026-05-29-notes-in-job-fit-design.md`

---

## File map

| File | Action |
|------|--------|
| `prisma/schema/jobs.prisma` | Add `notesIncludeInFit Boolean @default(false)` |
| `src/app/types/job-application.ts` | Add `notesUsed?: boolean` to `JobFit` type |
| `src/modules/jobs/schema.ts` | Add `notesUsed` field to `JobFitSchema` |
| `src/modules/jobs/mutations.ts` | Update `updateJobNotes` to accept + persist `includeInFit` |
| `src/modules/jobs/job-fit.ts` | Select `notes`/`notesIncludeInFit`, inject prompt block |
| `src/app/dashboard/job-applications/_components/job-notes.tsx` | Add `initialIncludeInFit` prop + checkbox UI |
| `src/app/dashboard/job-applications/_components/job-row.tsx` | Pass `notesIncludeInFit` to `JobNotes` |
| `src/app/dashboard/job-applications/_components/job-fit.tsx` | Render "Notes included" indicator |

---

### Task 1: Schema migration — add `notesIncludeInFit`

**Files:**
- Modify: `prisma/schema/jobs.prisma`

- [ ] **Step 1: Add the field to the schema**

Open `prisma/schema/jobs.prisma`. After the `notes String?` line, add:

```prisma
notesIncludeInFit Boolean @default(false)
```

The `JobApplication` model block should now look like:

```prisma
model JobApplication {
  id                String    @id @default(cuid())
  profileId         String
  jobNumber         String?
  title             String
  company           String
  url               String?
  countries         String[]
  dateApplied       DateTime?
  status            String    @default("not started")
  progress          String    @default("not started")
  applicationSource String    @default("cold")
  jobFit              Json?
  jobFitAssessedAt    DateTime?
  jobDescription      String?
  notes             String?
  notesIncludeInFit Boolean   @default(false)
  tags              String[]
  datePublished     DateTime? @default(now())
  lastUpdated       DateTime  @updatedAt
  archivedAt        DateTime?

  profile      Profile               @relation(fields: [profileId], references: [id], onDelete: Cascade)
  contacts     ApplicationContact[]
  events       ApplicationEvent[]
  cvDocuments  CVDocument[]
  coverLetters CoverLetterDocument[]

  @@index([profileId])
  @@index([status])
  @@index([profileId, archivedAt])
}
```

- [ ] **Step 2: Run the migration**

```bash
npm run db:migrate
```

When prompted for a migration name, enter: `add_notes_include_in_fit`

Expected: migration file created in `prisma/migrations/`, DB schema updated, `Generated Prisma Client` message at the end.

- [ ] **Step 3: Verify the field exists**

```bash
npm run db:studio
```

Open Prisma Studio in the browser, find any `JobApplication` row, confirm `notesIncludeInFit` column exists with value `false`. Close Studio.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema/jobs.prisma prisma/migrations/
git commit -m "feat: add notesIncludeInFit field to JobApplication"
```

---

### Task 2: Types + Zod schema — add `notesUsed`

**Files:**
- Modify: `src/app/types/job-application.ts`
- Modify: `src/modules/jobs/schema.ts`

- [ ] **Step 1: Update the `JobFit` type**

In `src/app/types/job-application.ts`, the `JobFit` type currently is:

```ts
export type JobFit = {
  rating: number
  label: "poor" | "ok" | "stretch" | "good" | "excellent"
  justification: string
  trajectoryNote?: string
}
```

Add `notesUsed`:

```ts
export type JobFit = {
  rating: number
  label: "poor" | "ok" | "stretch" | "good" | "excellent"
  justification: string
  trajectoryNote?: string
  notesUsed?: boolean
}
```

- [ ] **Step 2: Update `JobFitSchema`**

In `src/modules/jobs/schema.ts`, the `JobFitSchema` currently ends with `trajectoryNote`. Add `notesUsed` after it:

```ts
export const JobFitSchema = z.object({
  rating: z.number().min(0).max(10).describe('Overall fit score, 0 = no match, 10 = perfect match.'),
  label: z.enum(['poor', 'ok', 'stretch', 'good', 'excellent'])
    .describe('Bucketed verdict. "stretch" = could land it with effort; "good" = strong baseline match.'),
  justification: z.string().min(1)
    .describe('Two or three sentences. Concrete reasoning grounded in candidate and role specifics, no fluff.'),
  trajectoryNote: z.string().optional()
    .describe("One or two sentences on how this role relates to the candidate's stated career goals and target direction. Omit entirely when no career goals are provided."),
  notesUsed: z.boolean().optional()
    .describe('Set to true when personal notes were included in this assessment. Omit or set false otherwise.'),
})
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/types/job-application.ts src/modules/jobs/schema.ts
git commit -m "feat: add notesUsed to JobFit type and schema"
```

---

### Task 3: Update `updateJobNotes` mutation

**Files:**
- Modify: `src/modules/jobs/mutations.ts`

- [ ] **Step 1: Update the function signature and body**

In `src/modules/jobs/mutations.ts`, find the `updateJobNotes` function (currently at the bottom of the file):

```ts
export async function updateJobNotes(id: string, notes: string) {
  const { profile } = await requireProfile()

  const result = await prisma.jobApplication.updateMany({
    where: { id, profileId: profile.id },
    data: { notes: notes.trim() || null },
  })
  if (result.count === 0) throw new Error('Job not found')

  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${id}`)
}
```

Replace it with:

```ts
export async function updateJobNotes(id: string, notes: string, includeInFit: boolean) {
  const { profile } = await requireProfile()
  const trimmed = notes.trim()

  const result = await prisma.jobApplication.updateMany({
    where: { id, profileId: profile.id },
    data: {
      notes: trimmed || null,
      notesIncludeInFit: trimmed ? includeInFit : false,
    },
  })
  if (result.count === 0) throw new Error('Job not found')

  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${id}`)
}
```

Key: when notes are blanked (`trimmed` is empty), `notesIncludeInFit` is always reset to `false`.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: TypeScript will now complain about the call sites in `job-notes.tsx` that pass only 2 args — that's expected and will be fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/modules/jobs/mutations.ts
git commit -m "feat: update updateJobNotes to persist notesIncludeInFit flag"
```

---

### Task 4: Inject notes into `assessJobFit` prompt

**Files:**
- Modify: `src/modules/jobs/job-fit.ts`

- [ ] **Step 1: Expand the DB select to include notes fields**

In `src/modules/jobs/job-fit.ts`, find the `prisma.jobApplication.findFirst` call. Currently:

```ts
const job = await prisma.jobApplication.findFirst({
  where: { id: jobId, profileId: profile.id },
  select: { id: true, title: true, company: true, jobDescription: true },
})
```

Replace with:

```ts
const job = await prisma.jobApplication.findFirst({
  where: { id: jobId, profileId: profile.id },
  select: { id: true, title: true, company: true, jobDescription: true, notes: true, notesIncludeInFit: true },
})
```

- [ ] **Step 2: Derive the `hasNotes` flag**

Directly after the `hasGoals` line (which reads `const hasGoals = ...`), add:

```ts
const hasNotes = job.notesIncludeInFit && !!job.notes?.trim()
```

- [ ] **Step 3: Inject the Personal Notes block into the user prompt**

In the user prompt construction, after the line:

```ts
  if (hasGoals) {
    userPrompt += '\n\n# Career Goals\n'
    // ...
  }
```

Add (after the closing brace of the `hasGoals` block):

```ts
  if (hasNotes) {
    userPrompt += `\n\n# Personal Notes\n\n${job.notes}`
  }
```

- [ ] **Step 4: Update the return instruction to hint `notesUsed`**

Find the last `userPrompt +=` line that says:

```ts
  userPrompt += `\n\nReturn a single JSON object matching the schema. Two or three sentences in the justification${hasGoals ? '; one or two sentences in trajectoryNote' : ''}.`
```

Replace it with:

```ts
  userPrompt += `\n\nReturn a single JSON object matching the schema. Two or three sentences in the justification${hasGoals ? '; one or two sentences in trajectoryNote' : ''}${hasNotes ? '. Set notesUsed to true.' : ''}.`
```

- [ ] **Step 5: Verify the full updated function looks correct**

The relevant section of `assessJobFit` after your changes should read:

```ts
  const hasNotes = job.notesIncludeInFit && !!job.notes?.trim()

  const system = `You are an experienced career coach...`

  let userPrompt = `# Candidate\n\n${serializeProfileForLLM(snapshot)}\n\n# Role\n\n**${job.title}** at ${job.company}\n\n${job.jobDescription}`

  if (hasGoals) {
    userPrompt += '\n\n# Career Goals\n'
    if (context.targetRole)      userPrompt += `\n**Target role:** ${context.targetRole}`
    if (context.industries)      userPrompt += `\n**Industries:** ${context.industries}`
    if (context.workPreferences) userPrompt += `\n**Work preferences:** ${context.workPreferences}`
    if (context.extraContext)    userPrompt += `\n**Additional context:** ${context.extraContext}`
  }

  if (hasNotes) {
    userPrompt += `\n\n# Personal Notes\n\n${job.notes}`
  }

  userPrompt += `\n\nReturn a single JSON object matching the schema. Two or three sentences in the justification${hasGoals ? '; one or two sentences in trajectoryNote' : ''}${hasNotes ? '. Set notesUsed to true.' : ''}.`
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/modules/jobs/job-fit.ts
git commit -m "feat: include personal notes in job-fit LLM prompt when flagged"
```

---

### Task 5: Update `JobNotes` component — add checkbox

**Files:**
- Modify: `src/app/dashboard/job-applications/_components/job-notes.tsx`

- [ ] **Step 1: Replace the entire file with the updated component**

The current file is at `src/app/dashboard/job-applications/_components/job-notes.tsx`. Replace its contents with:

```tsx
'use client'

import { useState, useTransition } from "react"
import { StickyNote } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { updateJobNotes } from "@/modules/jobs/mutations"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type JobNotesProps = {
  jobId: string
  initialNotes: string | null
  initialIncludeInFit: boolean
}

export function JobNotes({ jobId, initialNotes, initialIncludeInFit }: JobNotesProps) {
  const [saved, setSaved] = useState(initialNotes ?? '')
  const [savedIncludeInFit, setSavedIncludeInFit] = useState(initialIncludeInFit)
  const [draft, setDraft] = useState(saved)
  const [includeInFit, setIncludeInFit] = useState(initialIncludeInFit)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const hasNotes = saved.trim().length > 0
  const isDirty = draft !== saved || includeInFit !== savedIncludeInFit

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(saved)
      setIncludeInFit(savedIncludeInFit)
    }
    setOpen(next)
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateJobNotes(jobId, draft, includeInFit)
        const trimmed = draft.trim()
        const effectiveIncludeInFit = trimmed ? includeInFit : false
        setSaved(trimmed)
        setDraft(trimmed)
        setSavedIncludeInFit(effectiveIncludeInFit)
        setIncludeInFit(effectiveIncludeInFit)
        setOpen(false)
        toast.success(trimmed ? 'Note saved.' : 'Note cleared.')
      } catch {
        toast.error('Failed to save note. Please try again.')
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label={hasNotes ? 'View note' : 'Add note'}
        title={hasNotes ? 'View note' : 'Add note'}
        className={cn(
          "flex size-6 items-center justify-center rounded-md transition-colors",
          hasNotes
            ? "hover:bg-muted/50"
            : "text-muted-foreground/40 hover:bg-muted hover:text-foreground",
        )}
      >
        <StickyNote
          size={14}
          className={hasNotes ? 'fill-amber-200 text-amber-500' : ''}
        />
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-3">
          <p className="text-sm font-semibold">Notes</p>
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Add a note..."
            rows={4}
            disabled={isPending}
            className="resize-none text-xs"
          />
          <label className={cn(
            "flex items-center gap-2 text-xs cursor-pointer select-none",
            (!draft.trim() || isPending) ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground",
          )}>
            <Checkbox
              checked={includeInFit}
              onCheckedChange={(v) => setIncludeInFit(Boolean(v))}
              disabled={isPending || !draft.trim()}
            />
            Include in job-fit assessment
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isPending || !isDirty}
            >
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: TypeScript will now complain about the call site in `job-row.tsx` missing the `initialIncludeInFit` prop — fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/job-applications/_components/job-notes.tsx
git commit -m "feat: add include-in-job-fit checkbox to JobNotes popover"
```

---

### Task 6: Pass `notesIncludeInFit` from `JobRow`

**Files:**
- Modify: `src/app/dashboard/job-applications/_components/job-row.tsx`

- [ ] **Step 1: Destructure `notesIncludeInFit` from job and pass to `JobNotes`**

In `src/app/dashboard/job-applications/_components/job-row.tsx`, find the destructuring line near the top of the `JobRow` function body:

```ts
const { id, jobNumber, title, company, countries, url, dateApplied, lastUpdated, status, progress, jobFit, notes, applicationSource, jobDescription } = job
```

Add `notesIncludeInFit`:

```ts
const { id, jobNumber, title, company, countries, url, dateApplied, lastUpdated, status, progress, jobFit, notes, notesIncludeInFit, applicationSource, jobDescription } = job
```

Then find the `<JobNotes>` usage:

```tsx
<JobNotes jobId={id} initialNotes={notes ?? null} />
```

Replace with:

```tsx
<JobNotes jobId={id} initialNotes={notes ?? null} initialIncludeInFit={notesIncludeInFit} />
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/job-applications/_components/job-row.tsx
git commit -m "feat: thread notesIncludeInFit from JobRow into JobNotes"
```

---

### Task 7: Show "Notes included" indicator in fit popover

**Files:**
- Modify: `src/app/dashboard/job-applications/_components/job-fit.tsx`

- [ ] **Step 1: Add `StickyNote` to the Lucide import**

In `src/app/dashboard/job-applications/_components/job-fit.tsx`, find the lucide-react import line:

```ts
import { Flame, Loader2, Sparkles } from "lucide-react"
```

Add `StickyNote`:

```ts
import { Flame, Loader2, Sparkles, StickyNote } from "lucide-react"
```

- [ ] **Step 2: Add the indicator inside the popover content**

Find the section in `PopoverContent` that renders `{jobFit.trajectoryNote && (...)}`. It currently looks like:

```tsx
{jobFit.trajectoryNote && (
  <>
    <Separator />
    <div>
      <p className="text-xs font-semibold mb-1.5">Your trajectory</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{jobFit.trajectoryNote}</p>
    </div>
  </>
)}

<Separator />

<div className="flex items-start justify-between gap-3">
  {/* AI disclaimer + re-assess button */}
</div>
```

Add the notes indicator block between the trajectory block and the final `<Separator />`:

```tsx
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
      Personal notes were included in this assessment.
    </p>
  </>
)}

<Separator />

<div className="flex items-start justify-between gap-3">
  {/* existing AI disclaimer + re-assess button */}
</div>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/job-applications/_components/job-fit.tsx
git commit -m "feat: show notes-included indicator in job-fit popover"
```

---

## Manual verification checklist

After all tasks are complete, start the dev server (`npm run dev`) and verify:

1. Open `/dashboard/job-applications`. Click the notes icon on a job with no notes — checkbox should be **disabled**.
2. Type a note in the textarea — checkbox becomes **enabled**.
3. Check the box and click **Save** — popover closes, toast "Note saved."
4. Re-open the notes popover — checkbox is **checked** and text is preserved.
5. Run "assess fit" on that job (requires LLM key + job description). After assessment, open the fit popover — should see "Personal notes were included in this assessment." with the amber StickyNote icon.
6. Uncheck the box in the notes popover, save, re-assess — notes indicator **does not appear** in the fit popover.
7. Clear the note text entirely, save — checkbox resets to unchecked and disabled; a subsequent assessment doesn't include notes.
