# UI Fix Branch Design
**Date:** 2026-06-18
**Issues:** #277, #272, #275, #213
**Branch:** `feat/ui-fixes`

---

## Overview

Five targeted improvements in one PR: responsive column strategy for the job list, accordion wrappers for the Job Hunt sidebars and discovered jobs, updated skeleton loaders, and section-level AI coaching for cover letters.

---

## 1 — #277: Job list responsive columns

### Problem
The desktop grid activates at `md` (768px) with 11 columns. At that width the Role column (the most important field) gets crushed by the surrounding `auto`-width columns.

### Solution
Three-phase column reveal using Tailwind responsive prefixes. The parent `grid-cols-` in `job-list.tsx:352` becomes:

```
md:grid-cols-[auto_1.5fr_auto_auto_auto_auto]
lg:grid-cols-[auto_1.5fr_auto_1fr_auto_auto_auto_auto]
xl:grid-cols-[auto_1.5fr_auto_1fr_auto_auto_auto_auto_auto_auto_auto]
```

**Columns visible at each breakpoint:**

| Breakpoint | Visible columns |
|------------|----------------|
| `md` | Checkbox, Role, Status, Salary, Fit, Controls |
| `lg` | + Progress, Applied |
| `xl` | + Published, Notes, Updated |

Both `ColHeaders` and `JobRow` get matching `hidden lg:block` / `hidden xl:block` classes on the hidden cells so the subgrid always matches the parent template. No changes to `job-row-card.tsx` (mobile card view, unchanged).

### Files
- `src/app/dashboard/job-applications/_components/job-list.tsx` — grid template
- `src/app/dashboard/job-applications/_components/job-row.tsx` — cell visibility classes
- (ColHeaders is defined inline in `job-list.tsx` — update there too)

---

## 2 — #272: Job Hunt accordions

### Problem
The Watchlist (companies) and JobBoardSources sections can grow long with no way to collapse them. The issue also asks for a mini stats panel in the header.

### Solution A — Watchlist + JobBoardSources collapsibles

Both sections become shadcn `Collapsible` components. Both start expanded by default. The trigger header shows:

**Pill stats format:** `[N total] [✓ N working] [✗ N failed]` (failed pill omitted when count is zero).

- **Watchlist header:** derives working/failed from `watches` prop — working = `status === 'active' && !lastScanError`, failed = inverse.
- **JobBoardSources header:** derives active count from `sources` prop (no scan errors). `JobBoardSources` becomes a Client Component to hold open/closed state.

Chevron rotates 180° when collapsed (standard shadcn pattern via `data-[state=open]:rotate-180`).

### Solution B — Discovered Roles accordion groups

`DiscoveredJobs` replaces its flat list with three accordion groups. Source tabs (All / Company / Boards / Scored) are kept as a global filter above the groups.

**Group definitions (no schema change):**

| Group | Logic |
|-------|-------|
| Found today | `createdAt >= start of today` AND `status ∈ { new, scored }` |
| Under review | `status ∈ { new, scored }` AND `createdAt < today` |
| Imported | `status === 'imported'` |

Ignored jobs remain hidden behind the existing "Show ignored" toggle.

**Header pill:** each group shows a count pill. "Found today" uses `pill-warn` (amber) when non-empty to draw attention. "Imported" uses `pill-ok` (green).

All three groups start expanded. State is local `useState` — no persistence.

### Files
- `src/app/dashboard/job-hunt/_components/watchlist.tsx` — wrap in Collapsible
- `src/app/dashboard/job-hunt/_components/job-board-sources.tsx` — convert to client + wrap in Collapsible
- `src/app/dashboard/job-hunt/_components/discovered-jobs.tsx` — replace flat list with three groups

---

## 3 — #275: Skeleton loaders

### Problem
Both `loading.tsx` files show generic tall rectangles that don't match the actual page layout, creating a jarring layout shift on load.

### Solution
Update both files to approximate the real layout. No component-level refactor — static JSX only.

**`job-applications/loading.tsx`:**
- Filter bar row: search input skeleton + two filter chip skeletons
- Column header strip at reduced opacity
- 5 row skeletons at ~40px height — each with: checkbox dot, role name bar + company sub-bar, status pill, progress bar, salary chip, fit dot

**`job-hunt/loading.tsx`:**
- Criteria summary bar skeleton
- Sync status bar skeleton
- 3-column grid mirroring `lg:grid-cols-[280px_280px_1fr]`:
  - Col 1 (Watchlist): title bar + 3 company row skeletons
  - Col 2 (Job Boards): title bar + 3 board row skeletons
  - Col 3 (Discovered): title bar + 5 shorter job row skeletons

### Files
- `src/app/dashboard/job-applications/loading.tsx`
- `src/app/dashboard/job-hunt/loading.tsx`

---

## 4 — #213: Cover letter section-level AI coaching

### Problem
`propose_cover_letter_update` forces a full document replacement. The user says "rewrite the opening paragraph" and the AI rewrites and returns 400 words. This is expensive and destructive. Compare to `propose_cv_update` which already targets a specific `sectionId`.

### Data model

`sections` column already exists as `String @default("[]")`. No migration needed. Change the stored format from a flat string array to a structured array with stable IDs:

```ts
// stored in sections column
type CoverLetterSection = { id: string; content: string }
// e.g. [{ id: "s_abc123", content: "Dear Hiring Manager,\n\n..." }, ...]
```

IDs are generated with `cuid()` (already a dep). IDs are stable across re-edits where the paragraph is unchanged — a re-derive that matches an existing paragraph by content preserves its ID.

### Actions (`src/modules/cover-letters/actions.ts`)

**`updateCoverLetterContent(id, content)`** (existing) — after writing `content`, re-derive sections by splitting on `/\n\n+/`, matching existing IDs by content where possible, generating new IDs for changed/new paragraphs. Write both fields atomically.

**`updateCoverLetterSection(letterId, sectionId, newContent)`** (new) — find the section by ID in the stored array, replace its `content`, rebuild the full `content` string by joining sections with `\n\n`, write both fields.

### Chat tools (`src/modules/chat/tools.ts`)

**`get_cover_letter`** — add `sections` to the returned object so the AI sees the array with IDs.

**`propose_cover_letter_section_update`** (new tool, no `execute` — client-handled like `propose_cv_update`) — input schema:
```ts
{
  letterId: string
  sectionId: string  // ID of the section to replace
  sectionIndex: number  // 0-based, for display purposes ("paragraph 2 of 4")
  currentContent: string  // what the section says now
  proposedContent: string  // the replacement paragraph
  rationale: string
}
```

Keep `propose_cover_letter_update` for cases where the AI needs to restructure the whole letter (major rewrites, tone changes).

### UI

The workspace textarea and `updateCoverLetterContent` path are unchanged — the single-textarea editing experience stays. The coach confirmation card for `propose_cover_letter_section_update` shows a before/after diff of just the target paragraph. Per-section inline editing in the workspace is a follow-up PR.

### Files
- `src/modules/cover-letters/actions.ts` — update `updateCoverLetterContent`, add `updateCoverLetterSection`
- `src/modules/chat/tools.ts` — update `get_cover_letter`, add `propose_cover_letter_section_update`
- `src/components/shell/chat-message.tsx` — add confirmation card for the new proposal tool
- `src/app/api/chat/stream/route.ts` — wire the client-side handler for section updates (mirrors CV update handler)

---

## Issues closed by this PR
- #277 — MD size rows overlap
- #275 — Skeleton loaders out of date
- #272 — Job Hunt - Compact Companies
- #213 — Cover letter sections (section-level AI coaching)
