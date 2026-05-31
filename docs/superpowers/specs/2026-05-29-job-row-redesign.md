# JobRow Redesign

## Context

The `JobRow` component has grown incrementally and now feels heavy — the date cells in particular add vertical bulk. The controls column bundles unrelated concerns (job fit, notes, and the action menu). Salary band has never been tracked, even though it's often available on the job posting and useful to compare across applications.

This spec covers a column reorder, row density reduction, salary band introduction, date format change, and minor icon polish.

---

## Column Layout

New column order (left to right):

```
[checkbox] | title/company | status | progress | salary | fit | date-applied | notes | last-updated | controls
```

Grid definition in `job-list.tsx`:

```
grid-cols-[auto_1.5fr_auto_1fr_auto_auto_auto_auto_auto_auto]
```

Previous order had fit and notes bundled into the trailing `controls` `auto` column. They now each get their own `auto` column. Controls becomes the ⋯ menu (`AppControls`) only.

---

## Row Density

Reduce padding from `py-3` to `py-2` on each cell and the row container. Target ~42px row height (currently ~52px). This is the "comfortable" target — not aggressively compact, but meaningfully tighter.

---

## Salary Band

### Schema

Add `salaryBand String?` to `JobApplication` in `prisma/schema/jobs.prisma`. Free-form string (e.g. `"$180–220k"`, `"£60k"`, `"Competitive"`). No structured range type — salary formats vary too widely across regions and companies to normalize reliably.

Create a migration: `npm run db:migrate` with name `add-salary-band`.

### Type & Validation

- Add `salaryBand?: string | null` to the `Job` type in `src/app/types/job-application.ts`
- Add `salaryBand: z.string().max(100).optional()` to both `createJobSchema` and `updateJobSchema` in `src/modules/jobs/schema.ts`

### Mutation

Add `updateJobSalaryBand(id: string, salaryBand: string | null)` to `src/modules/jobs/mutations.ts` — same shape as `updateJobDate`: `updateMany` with `profileId` guard + `revalidatePath`.

### Extraction

`ExtractedJob` in `src/modules/jobs/extract.ts` gains `salaryBand?: string`.

In `fromJsonLd`: parse the `baseSalary` field from `JobPosting` schema and format it. A `MonetaryAmount` with `minValue`/`maxValue` produces `"$180k–$220k"`; a flat `value` produces `"$180k"`. Currency symbol is derived from the `currency` code (USD → `$`, GBP → `£`, EUR → `€`, fallback to the code itself). Values ≥ 1000 are abbreviated with `k`.

LinkedIn and Greenhouse extraction don't have a structured salary field — skip for now. The user can fill it in manually.

In `capture.ts`, pass `salaryBand` from the extracted data through to `prisma.jobApplication.create`.

### Inline Edit Component

New file: `src/app/dashboard/job-applications/_components/salary-band-cell.tsx`

Pattern mirrors `ApplicationDateBlock`:
- Client component, uses `useState` + `useTransition`
- Empty state: `—` (muted)
- Hover reveals an edit icon (pencil, same style as the date block's trigger)
- Popover contains a plain text `<Input>`, a clear button, and a Save button
- Saves via `updateJobSalaryBand`; clears by submitting empty string (stored as null)

---

## Date Format

Change date display in `ApplicationDateBlock` from `date.toLocaleDateString()` to `dd MMM yy` format (e.g. "12 May 25"). Use `Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })`. The `en-CA` format used for the `<input type="date">` value is unaffected — it's only used to seed the picker.

Add a `formatShortDate(date: Date): string` helper to `src/lib/utils.ts`. `ApplicationDateBlock` switches to it; `formatDate` stays unchanged (used elsewhere).

The "X days ago" line below the date is fine to keep for the applied date. For the last-updated column (read-only, always auto-set), simplify: show only the relative form since the exact date is less relevant there.

Add a `formatRelative(days: number): string` helper to `src/lib/utils.ts`:
- 0 → `"today"`
- 1–13 → `"Xd ago"`
- 14–59 → `"Xw ago"` (floor(days / 7))
- ≥ 60 → `"Xmo ago"` (floor(days / 30))

---

## Job Fit Icon

Replace `Sparkles` with `Puzzle` (lucide-react) in `job-fit.tsx` — both the "assess" button and the "re-assess" button inside the popover. The `FitPill` keeps its `Flame` icon (that's the score indicator, not the action trigger).

---

## Column Headers

Add a thin header row above the first `JobGroup` in the grid. It uses `col-span-full grid grid-cols-subgrid` (same as rows) so columns align. Content: empty checkbox column, then `Role · Company`, `Status`, `Progress`, `Salary`, `Fit`, `Applied`, `Notes`, `Updated`, empty controls column. Styled with `text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 py-1.5 px-3`.

With headers present, per-cell labels are redundant — remove the `{label}:` text from `ApplicationDateBlock` and the inline "Applied" / "Last Update" text from the row.

## Vertical Stack Reduction in ApplicationDateBlock

The current component renders a label row, a date row, and a relative-time row — three lines that inflate row height. Slim it down:

- Remove the inline `{label}:` text (replaced by column header above).
- Keep the formatted date on one line (drop the Calendar icon — redundant with the column context).
- Keep "X days ago" as a small muted line below for the applied date cell; last-updated uses relative-only format.
- The edit pencil trigger sits inline to the right of the date, visible on row hover.

---

## EditJobDialog

Add a `Salary band` text input to the edit dialog form (`src/app/dashboard/job-applications/_components/edit-job-dialog.tsx`) so the field is also reachable from the full edit flow. Single `<Input>` with placeholder `"e.g. $120–140k"`.

---

## Verification

1. `npm run db:migrate` succeeds with no errors
2. `npm run typecheck` passes
3. Open the job applications page — rows are visibly tighter, columns reordered
4. A job with no salary shows `—`; hovering reveals the edit pencil; clicking opens the popover; saving persists and reflects immediately
5. Capture a job from a JSON-LD site (e.g. Lever) that includes `baseSalary` — salary band populates automatically
6. Job fit "assess" button shows a puzzle piece icon
7. Date cells show "12 May 25" format
8. Last-updated column shows relative time only
