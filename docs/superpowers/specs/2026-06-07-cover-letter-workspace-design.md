# Cover Letter Workspace Design

**Issues:** #130 (workspace), #131 (AI writing guide — stub only in this spec)

---

## Goal

A first-class writing desk for cover letters. Markdown-first, auto-saving, with a slide-out job context panel. Attached to a job application or standalone. Accessible from the job row menu (mirrors the CV generation flow). AI writing guide is scaffolded but disabled pending #131.

---

## Routes

| Path | Description |
|---|---|
| `/dashboard/cover-letters` | Index — list of all cover letters |
| `/dashboard/cover-letters/new` | Server action — creates a new document, redirects to `[id]` |
| `/dashboard/cover-letters/new?jobId=<id>` | Same, pre-linked to a job application |
| `/dashboard/cover-letters/[id]` | Workspace — the writing surface |

The `new` route is a Server Action endpoint (not a rendered page). It creates the record and immediately redirects to the workspace.

---

## Schema Change

Add `content` to `CoverLetterDocument`:

```prisma
model CoverLetterDocument {
  // ... existing fields ...
  content  String   @default("")
  sections String   @default("[]")   // legacy — keep, do not use in workspace
  // ...
}
```

Migration name: `add_cover_letter_content`

The `sections` field stays untouched; it is legacy and unused by the workspace.

---

## Module: `src/modules/cover-letters/`

Three files, matching the canonical small-module shape (see `src/modules/onboarding/`):

### `schema.ts`

```ts
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
```

### `queries.ts`

- `listCoverLetters(profileId)` — returns all letters ordered by `updatedAt DESC`, selecting: id, jobApplicationId, jobTitle, company, status, content (first 120 chars is enough for the snippet — fetch full, truncate in UI), createdAt, updatedAt
- `getCoverLetter(profileId, id)` — returns the full document including the linked job application's `title`, `company`, `status`, `jobFit`, and job description excerpt for the panel

### `actions.ts`

Server Actions:

- `createCoverLetter(jobApplicationId?: string)` — creates the document, returns the new `id` for redirect. Sets `mode = "markdown"`, `status = "draft"`, `content = ""`. If `jobApplicationId` provided, copies `jobTitle` and `company` from the job record.
- `updateCoverLetterContent(id: string, content: string)` — updates `content` only; bumps `updatedAt` via Prisma's `@updatedAt`. Auth-guards by checking `profileId`.
- `deleteCoverLetter(id: string)` — hard delete, auth-guarded.

---

## Index Page `/dashboard/cover-letters`

Server component. Calls `listCoverLetters`.

### Header

```
Cover Letters                                    [+ New]
3 drafts
```

"+ New" links to `/dashboard/cover-letters/new` (standalone, no job).

### List

Simple vertical list. Each row:

```
[job title · company]                  [status]  [2h ago]
Opening line of the cover letter truncated to one line…
```

- Click anywhere on the row navigates to the workspace
- `status` values: `draft` (muted), `sent` (green)
- Rows separated by a thin border, `hover:bg-accent/50` on hover
- No left-stripe accent (impeccable ban)

### Empty State

When no cover letters exist:

```
No cover letters yet.
Start from a job application → or write a standalone letter.
```

"Start from a job application →" links to `/dashboard/job-applications`. "write a standalone letter" links to `/dashboard/cover-letters/new`.

### Footer hint

Below the list (when letters exist):

```
Start a new letter from any job application in the jobs list →
```

Links to `/dashboard/job-applications`.

---

## Workspace `/dashboard/cover-letters/[id]`

Client component. Loads the full document + linked job data via `getCoverLetter`.

### Toolbar

Single horizontal bar, `border-b`:

```
[job title · company]           [Markdown | Preview]      [Saved] [Copy] [Job ▸]
[Cover Letter]
```

- **Left**: job title bold, company muted, "Cover Letter" sub-label in xs. If standalone (no linked job): "Cover Letter" as title, no company line.
- **Centre**: `Markdown` / `Preview` pill toggle. Active pill: `bg-foreground text-background`. Inactive: `text-muted-foreground`.
- **Right**:
  - Save state: "Saving…" while debounce in flight, "Saved" when persisted, "Save failed" (red) on error.
  - "Copy" button: copies current content to clipboard.
  - "Job ▸" button: toggles the job context panel. Hidden if no linked job.

### Editor

Below the toolbar, full remaining height:

```
[bg-secondary padding area]
  [max-w-[560px] centered bg-primary rounded card]
    [textarea or rendered markdown]
```

**Markdown mode:** `<textarea>` with monospace font, `resize-none`, full card height. No border on the textarea itself — the card provides the boundary.

**Preview mode:** rendered markdown. Use `react-markdown` with `prose` Tailwind classes. Same card shape.

### Auto-save

Debounce 1.5 s from the last keystroke. Calls `updateCoverLetterContent`. State machine:

- `idle` → `saving` (on debounce fire) → `saved` (on success) or `error` (on failure)
- Any keystroke resets back to `idle`

### Empty State (no content)

When `content === ""`, show inside the card instead of a blank textarea:

```
No cover letter yet

Start writing your cover letter for this role, or open the
writing guide to help prepare a draft.

[Start writing]  [Writing guide]
```

- "Start writing" focuses the textarea (switches to edit mode, hides the empty state, shows the textarea).
- "Writing guide" is disabled with a tooltip: "Coming soon — requires AI to be configured". This is the #131 stub.

### Job Context Panel

Triggered by "Job ▸" button. Slides in from the right, overlapping the editor area (not pushing it). Editor gets `opacity-50` while panel is open.

Panel width: `w-[42%]` max, `min-w-[240px]`. `border-l bg-background`.

Contents:

```
Job Context                           [✕]

[job title]
[company]
[status · fit score if available]

MUST-HAVES
• requirement 1
• requirement 2

NICE-TO-HAVES
• requirement 1

────────────────
✦ Writing guide — coming soon
```

Must-haves and nice-to-haves are extracted from `jobFit.requirements` if analysis has been run; otherwise show the raw job description (first 300 chars) with "View full description →".

"✦ Writing guide — coming soon" is a static label, no interactivity (#131 stub).

---

## Job Row Integration

### `AppControls` changes

Add two new optional props:

```ts
type AppControlsProps = {
  id: string
  cvDocumentId?: string | null
  coverLetterDocumentId?: string | null   // new
  onEdit?: () => void
  onArchive?: () => void
  onGenerateCV?: () => void
  onCreateCoverLetter?: () => void         // new
}
```

In the "File Management" `DropdownMenuGroup`, after the CV item, add:

```tsx
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
```

Use `Mail` from `lucide-react`.

### `job-list.tsx` changes

- `handleCreateCoverLetter(id: string)` → `router.push('/dashboard/cover-letters/new?jobId=${id}')`
- Pass `onCreateCoverLetter={handleCreateCoverLetter}` to each `JobRowCard`

### `job-row-card.tsx` changes

Add `onCreateCoverLetter: (id: string) => void` to props. Pass `coverLetterDocumentId={job.coverLetterDocumentId}` and `onCreateCoverLetter={() => onCreateCoverLetter(id)}` to `AppControls`.

### Data layer

The job list query needs to include the first linked cover letter's id. Add to the jobs select:

```ts
coverLetters: {
  select: { id: true },
  take: 1,
  orderBy: { updatedAt: 'desc' },
}
```

Map to `coverLetterDocumentId: job.coverLetters[0]?.id ?? null` in the result type.

---

## Implementation Notes

- The workspace page is a Client Component because it needs the textarea + debounce + panel toggle state.
- `getCoverLetter` is called once on mount (server-side via `use server` action or direct server component prop drilling). After that, content updates go through `updateCoverLetterContent` only.
- No optimistic UI for save state — the debounce window (1.5 s) is the buffer. If the user navigates away mid-debounce, the save fires first via `beforeunload` or they lose the last 1.5 s of typing (acceptable).
- The job panel data (must-haves, nice-to-haves) is read-only from `jobFit.requirements`. No writes from the panel.
- `status` is manually set — no automatic transitions in this spec. The user does not set it from the workspace in this iteration; it stays `draft`. Status management is out of scope for #130.

---

## Out of Scope (#130)

- AI-generated draft (requires #131)
- Writing guide content (requires #131)
- Status updates from the workspace
- Cover letter PDF export
- Linking a standalone cover letter to a job after creation
- Multiple cover letters per job (the UI shows one; the schema supports many, but the entry point creates one and the job row shows the most recent)
