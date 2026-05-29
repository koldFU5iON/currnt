# Notes in Job-Fit Assessment — Design Spec

## Context

Users can already add free-text notes to a job application via the `JobNotes` popover. The job-fit assessment (`assessJobFit`) runs an LLM evaluation of candidate vs. role. This feature lets users optionally include their personal note in that evaluation — giving the model additional context that isn't in the job description or candidate profile.

---

## Behaviour

- The `JobNotes` popover gains a checkbox: **"Include in job-fit assessment"** (disabled when the draft note is empty).
- Saving the popover persists both `notes` and `notesIncludeInFit` in one write.
- When `notesIncludeInFit` is cleared (notes blanked), the flag resets to `false`.
- The next time `assessJobFit` runs, if `notesIncludeInFit && notes`, a `# Personal Notes` block is appended to the LLM prompt.
- The LLM echoes `notesUsed: true` in its structured output when notes are included; `false`/omitted otherwise.
- The fit popover shows a small "Notes included" line at the bottom when `fit.notesUsed` is true.
- **No stale-assessment invalidation** — the old score is untouched; the flag takes effect on the next manual re-assess.

---

## Schema

`prisma/schema/jobs.prisma` — add one field to `JobApplication`:

```prisma
notesIncludeInFit Boolean @default(false)
```

Migration: `npm run db:migrate` with a descriptive name.

---

## Data flow

```
JobNotes (client)
  → updateJobNotes(id, notes, includeInFit)   ← mutations.ts
      → prisma.jobApplication.updateMany({ notes, notesIncludeInFit })

assessJobFit(jobId)                             ← job-fit.ts
  → prisma: select notes, notesIncludeInFit
  → if (notesIncludeInFit && notes) append # Personal Notes block
  → LLM returns { ..., notesUsed: true }
  → prisma.jobApplication.update({ jobFit: fit })

JobFit popover (client)
  → fit.notesUsed → show "Notes included" line
```

---

## File changes

| File | Change |
|------|--------|
| `prisma/schema/jobs.prisma` | Add `notesIncludeInFit Boolean @default(false)` |
| `src/modules/jobs/mutations.ts` | Update `updateJobNotes` signature + data payload |
| `src/modules/jobs/schema.ts` | Add `notesUsed: z.boolean().optional()` to `JobFitSchema` |
| `src/app/types/job-application.ts` | Add `notesUsed?: boolean` to `JobFit` type |
| `src/modules/jobs/job-fit.ts` | Select + inject notes into prompt; instruct model on `notesUsed` |
| `src/app/dashboard/job-applications/_components/job-notes.tsx` | Add `initialIncludeInFit` prop + checkbox |
| `src/app/dashboard/job-applications/_components/job-row.tsx` | Pass `notesIncludeInFit` to `JobNotes` |
| `src/app/dashboard/job-applications/_components/job-fit.tsx` | Show "Notes included" when `fit.notesUsed` |

---

## Component details

### `JobNotes` — new props + state

```tsx
type JobNotesProps = {
  jobId: string
  initialNotes: string | null
  initialIncludeInFit: boolean
}
```

New state: `const [includeInFit, setIncludeInFit] = useState(initialIncludeInFit)`

Checkbox (below `<Textarea>`, above button row):
```tsx
<label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
  <Checkbox
    checked={includeInFit}
    onCheckedChange={(v) => setIncludeInFit(Boolean(v))}
    disabled={isPending || !draft.trim()}
  />
  Include in job-fit assessment
</label>
```

`isDirty` includes the flag: `draft !== saved || includeInFit !== savedIncludeInFit`

On save: `await updateJobNotes(jobId, draft, includeInFit)`

On open/reset: restore both `draft` and `includeInFit` from their saved counterparts.

### `updateJobNotes` — updated signature

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

### `JobFitSchema` — new field

```ts
notesUsed: z.boolean().optional()
  .describe('Set to true when personal notes were included in this assessment.'),
```

### `assessJobFit` — notes injection

After loading the job, also read `notes` and `notesIncludeInFit`. Build the notes block:

```ts
const job = await prisma.jobApplication.findFirst({
  where: { id: jobId, profileId: profile.id },
  select: { id: true, title: true, company: true, jobDescription: true, notes: true, notesIncludeInFit: true },
})

const hasNotes = job.notesIncludeInFit && !!job.notes?.trim()
```

Append to `userPrompt` (after the job description, before the return instruction):

```ts
if (hasNotes) {
  userPrompt += `\n\n# Personal Notes\n\n${job.notes}`
}
```

Update the return instruction line to include the `notesUsed` hint:

```ts
userPrompt += `\n\nReturn a single JSON object matching the schema. Two or three sentences in the justification${hasGoals ? '; one or two sentences in trajectoryNote' : ''}${hasNotes ? '. Set notesUsed to true.' : ''}.`
```

### `JobFit` popover — notes indicator

Inside the popover, after the trajectory section (or after justification if no trajectory), add:

```tsx
{jobFit.notesUsed && (
  <>
    <Separator />
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <StickyNote size={11} className="fill-amber-200 text-amber-500" />
      Personal notes were included in this assessment.
    </p>
  </>
)}
```

This reuses the same amber `StickyNote` visual language as the notes popover trigger.

---

## Testing checklist

1. Add a note + check "Include in job-fit assessment" → save → re-open popover → checkbox stays checked
2. Clear the note → save → re-open → checkbox is unchecked and disabled
3. Uncheck the box → save → run assessment → fit popover shows no notes indicator
4. Check the box → save → run assessment → fit popover shows "Personal notes were included"
5. No note at all → checkbox is disabled in the popover
