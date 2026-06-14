# Job Application Hub — Design Spec

**Date:** 2026-06-14  
**Status:** Approved

---

## Problem

The job application workflow is fragmented across five separate pages (job list, CV builder, cover letter, cover letter guide, interview prep) with no persistent navigation between them. A user working on a single job must bounce back to the application list to move between tools, and there is no single page that gives a complete picture of where a job stands across all its assets.

---

## Solution

Three coordinated changes:

1. **Redesign the job view page** as a central hub — a three-column workspace showing job stats, fit score, tool status cards, job description, and notes all at once.
2. **Add a `JobContextNav` bar** to every job-scoped tool page (CV builder, cover letter, interview prep) so the user can jump between tools without returning to the list.
3. **Restructure the sidebar nav** into domain groups and add a live "Active Jobs" section showing interviewing and in-progress jobs.

---

## 1. Job Hub Page

**Route:** `/dashboard/job-applications/view/[id]`  
**File:** `src/app/dashboard/job-applications/view/[id]/page.tsx` and its `_components/`

### Layout

Full viewport height. No page scroll — each panel scrolls independently.

```
┌─────────────────────────────────────────────────────────┐
│ ← Back to applications          [Edit] [View listing]   │  ← header row
│ Senior Frontend Engineer · Stripe                       │
├────────────┬────────────────────────┬───────────────────┤
│  Sidebar   │   Job Description      │   Notes           │
│  200px     │   flex:1 scroll        │   flex:1 scroll   │
│            │                        │                   │
│  Stats     │                        │                   │
│  Fit card  │                        │                   │
│  Assets    │                        │                   │
│            │                        │                   │
└────────────┴────────────────────────┴───────────────────┘
```

Grid: `grid-template-columns: 200px 1fr 1fr`, `height: calc(100vh - var(--dashboard-header-height))`. The three-column grid sits below the page header row; both together fill the viewport.

### Left Sidebar

Scrollable vertically if content overflows. Three logical sections:

**Stats card** (replaces the current `JobStatsGrid` strip):
- Status (badge), Progress, Applied date, Last updated — displayed vertically within a card.

**Fit score card** (promotes the existing `JobFit` component):
- Prominent score display + strength label ("Strong match", "Partial match", etc.)
- Key matched skills snippet (from existing `jobFit` JSON)
- "Re-assess" button

**Application Assets section** (new):
- Section label: "Application Assets"
- Three tool cards: CV, Cover Letter, Interview Prep
- Each card:
  - **Asset exists** → title ("CV", "Cover Letter", "Prep"), status label (e.g. "Draft ready", "In progress"), last-edited date, "Open →" link to the tool page
  - **Asset does not exist** → title, "Not started", CTA button ("Generate CV", "Create cover letter", "Start prep") that triggers the existing creation flow (same targets as today: `/dashboard/cv-builder/new?jobId=…` etc.)
- One asset per job (not a list of multiple CVs/letters)

### Middle Column — Job Description

- Sticky header: "Job Description" label
- Body: independently scrollable, renders existing `MarkdownProse` component
- Empty state: "No job description captured" with a subtle edit prompt

### Right Column — Notes

- Sticky header: "Notes" label
- Body: independently scrollable, plain text (existing `job.notes` field)
- Empty state: "No notes yet"
- Notes are read-only on the hub (editing via the Edit dialog, same as today)

### Data Changes

`getJobApplicationById` currently does not include linked asset IDs. Update it to also include the first CV, cover letter, and interview prep session for the job:

```ts
// new includes in getJobApplicationById
cvDocuments: { select: { id: true }, take: 1, orderBy: { createdAt: 'desc' } },
coverLetters: { select: { id: true }, take: 1, orderBy: { updatedAt: 'desc' } },
interviewPrepSessions: { select: { id: true }, take: 1, orderBy: { createdAt: 'desc' } },
```

Map these to `cvDocumentId`, `coverLetterDocumentId`, `interviewPrepSessionId` on the returned `Job` type (matching the pattern already used in `getActiveJobs`).

---

## 2. Cross-Tool Navigation Bar (`JobContextNav`)

A horizontal strip rendered at the top of every job-scoped tool page, above that page's existing workspace chrome.

### Appearance

```
Stripe — Senior Frontend Engineer  |  Hub  ·  CV  ·  Cover Letter  ·  Prep
```

- Left: `{company} — {title}` (truncated, links to hub `/dashboard/job-applications/view/{jobId}`)
- Divider
- Right: links to each asset — **Hub**, **CV**, **Cover Letter**, **Prep**
  - Only rendered if that asset exists for this job (no greyed-out placeholders)
  - Current tool is visually active (accent colour or underline)

### Component

New shared component: `src/components/job-context-nav.tsx`

Props:
```ts
type JobContextNavProps = {
  jobId: string
  company: string | null
  title: string
  cvDocumentId: string | null
  coverLetterDocumentId: string | null
  interviewPrepSessionId: string | null
  current: 'hub' | 'cv' | 'cover-letter' | 'prep'
}
```

### Pages That Receive It

| Page | File | `current` value |
|---|---|---|
| CV Builder | `cv-builder/[id]/page.tsx` | `'cv'` |
| Cover Letter Workspace | `cover-letters/[id]/page.tsx` | `'cover-letter'` |
| Cover Letter Guide | `cover-letters/[id]/guide/page.tsx` | `'cover-letter'` |
| Interview Prep | `interview-prep/[id]/page.tsx` | `'prep'` |

Pages with no linked job (e.g. a cover letter not yet attached to a job) render nothing.

### Shared Data Query

New function `getJobAssets(jobId, profileId)` in `src/modules/jobs/queries.ts`:

```ts
// Returns sibling asset IDs for a given job — called in parallel with each tool page's main query
async function getJobAssets(jobId: string, profileId: string): Promise<{
  jobId: string
  company: string | null
  title: string
  cvDocumentId: string | null
  coverLetterDocumentId: string | null
  interviewPrepSessionId: string | null
}>
```

Each tool page calls this in parallel with its main data fetch using `Promise.all`.

---

## 3. Sidebar Navigation

**File:** `src/lib/nav-menu.ts` and `src/components/app-sidebar.tsx`

### Static Groups

Replace the current single flat "Navigation" group with three permanent groups:

| Group label | Items |
|---|---|
| **Career** | Home · Professional Profile · Search Context |
| **Job Hunt** | Discover Jobs · Applications |
| **Application Tools** | CV Builder · Cover Letters · Interview Prep |

CV Builder, Cover Letters, and Interview Prep remain as top-level nav items (they link to their list views — all CVs, all letters, all prep sessions). They are not removed.

### Active Jobs Section

A fourth section below the static groups, rendered dynamically.

**Label:** "Active Jobs"

**Content:** All jobs belonging to the user with status `interviewing` or `in-progress`, ordered by `lastUpdated` descending.

Each row:
- Job title + company (truncated to fit sidebar width)
- Status badge (coloured, matching the existing status colour system: `interviewing` → blue, `in-progress` → amber)
- Clicking the row navigates to the job's hub page (`/dashboard/job-applications/view/{id}`)
- The row for the currently viewed job is highlighted. On the hub page this is detected via `usePathname` (`/dashboard/job-applications/view/{id}`). On tool pages it uses `pageContext.jobId` from `usePageContext`. This requires `PageContextProvider` to be moved up in `dashboard/layout.tsx` to wrap `AppSidebar` as well as `AppShell` (currently it only wraps `AppShell` inside `SidebarInset`).

**Empty state:** "No active jobs" (subtle muted text)

**Data fetch:** The `dashboard/layout.tsx` server component fetches the active jobs list and passes it as a prop to `AppSidebar`. New query: `getActiveJobsForNav(profileId)` — returns `{ id, title, company, status }[]`, filtering `status IN ('interviewing', 'in-progress')`.

---

## Component Map

### New files
- `src/components/job-context-nav.tsx` — cross-tool nav bar
- `src/app/dashboard/job-applications/view/[id]/_components/job-sidebar.tsx` — left sidebar (stats + fit + assets)
- `src/app/dashboard/job-applications/view/[id]/_components/job-description-pane.tsx` — middle scroll column
- `src/app/dashboard/job-applications/view/[id]/_components/job-notes-pane.tsx` — right scroll column

### Modified files
- `src/app/dashboard/job-applications/view/[id]/page.tsx` — new three-column layout
- `src/app/dashboard/job-applications/view/[id]/_components/job-detail-header.tsx` — simplified (header row only)
- `src/modules/jobs/queries.ts` — update `getJobApplicationById` to include asset IDs; add `getJobAssets`; add `getActiveJobsForNav`
- `src/app/types/job-application.ts` — add `interviewPrepSessionId` to `Job` type
- `src/lib/nav-menu.ts` — restructure into grouped format
- `src/components/app-sidebar.tsx` — add groups + Active Jobs section
- `src/app/dashboard/layout.tsx` — fetch active jobs for nav; move `PageContextProvider` to wrap both `AppSidebar` and `AppShell`
- `src/app/dashboard/cv-builder/[id]/page.tsx` — add `JobContextNav`
- `src/app/dashboard/cover-letters/[id]/page.tsx` — add `JobContextNav`
- `src/app/dashboard/cover-letters/[id]/guide/page.tsx` — add `JobContextNav`
- `src/app/dashboard/interview-prep/[id]/page.tsx` — add `JobContextNav`

### Retired components
- `src/app/dashboard/job-applications/view/[id]/_components/job-stats-grid.tsx` — replaced by `job-sidebar.tsx`
- `src/app/dashboard/job-applications/view/[id]/_components/job-details-card.tsx` — split into `job-description-pane.tsx` and `job-notes-pane.tsx`

---

## Out of Scope

- Multiple CVs or cover letters per job (one-per-job throughout)
- Editing notes inline on the hub (editing remains via the Edit dialog)
- AI chat changes (existing shell chat panel is sufficient; it already picks up job context when on the hub)
- Mobile layout (existing responsive behaviour is preserved; the three-column grid collapses gracefully on narrow viewports)
