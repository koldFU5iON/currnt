# Job Fit Score — Display Overhaul + Context-Aware Scoring

**Date:** 2026-05-28
**Issue:** #36 — Job-fit scoring ignores onboarding search context

---

## Problem

Two distinct issues to fix together:

1. **Bug:** `assessJobFit` scores purely against the career profile and job description. It never reads `onboardingContext` (target role, industries, work preferences) from `UserSettings`, so the LLM is blind to the user's actual job search intent.

2. **Display:** The fit score is hidden behind a tiny 14px flame icon. It is invisible unless the user knows to click it — undermining the "quick win" value of the score.

---

## Solution Overview

- Replace the row's click-to-reveal flame with an always-visible badge pill
- Extend the LLM schema with an optional `trajectoryNote` field driven by onboarding context
- Expand the popover into two sections: skills fit + career trajectory narrative
- Add fit to the job detail page stats grid
- Handle the no-LLM-key state gracefully with a tooltip nudge

---

## Section 1 — Row Display

The `JobFit` component becomes a badge pill: `[flame] [label]`, always visible on the row.

### Color palette (cold → hot)

| Label | Color |
|---|---|
| poor | Blue (`text-blue-400 fill-blue-400`) |
| ok | Amber-200 |
| stretch | Amber-400 |
| good | Orange-500 |
| excellent | Red-500 |

### States

| State | Display |
|---|---|
| Assessed | Flame pill — clickable, opens popover |
| Unassessed, can assess | Sparkles pill button — `[✦] assess` |
| Unassessed, no description | Sparkles pill, disabled, tooltip: "Add a job description first" |
| Pending | Spinner replaces flame icon |
| No LLM key | Sparkles pill, disabled, tooltip: "Add an LLM API key in Settings to assess fit" (links to `/dashboard/settings/llm`) |

Consistent pill shape across all states keeps the column width stable.

---

## Section 2 — Popover Structure

Width: `w-80`. Two sections separated by a divider.

### Fit
- Header: label (capitalised) + `rating/10` monospace
- Body: `justification` text

### Your trajectory
- Only rendered when `onboardingContextHasContent(context)` is true
- Heading: "Your trajectory"
- Body: `trajectoryNote` — one or two sentences from the LLM on how this role relates to the user's stated career goals and target direction
- Omitted entirely when onboarding context is empty

### Footer
- Disclaimer: "AI assessments can be wrong — trust your gut." + "Update your profile" link to `/dashboard/career-profile`
- Re-assess button (existing behaviour)

---

## Section 3 — LLM Schema and Prompt

### Schema change (`src/modules/jobs/schema.ts`)

Add one optional field to `JobFitSchema`:

```ts
trajectoryNote: z.string().optional()
  .describe("One or two sentences on how this role relates to the candidate's stated career goals and target direction. Omit if no goal context was provided.")
```

No DB migration needed — `jobFit` is a `Json` column; new fields appear in stored objects going forward.

### Prompt change (`src/modules/jobs/job-fit.ts`)

1. Fetch `onboardingContext` from `UserSettings` via a direct Prisma read scoped to `profile.id` (avoids a redundant `requireProfile()` call since the profile is already in scope)
2. If `onboardingContextHasContent(context)` is true, append a `# Career Goals` block to the user prompt:
   - Target role
   - Industries
   - Work preferences
   - Extra context
3. Add to the system prompt: "When career goals are provided, populate `trajectoryNote` with one or two sentences on alignment. Omit the field entirely when no goals are provided."

### No-key guard

Before building the prompt, check `getLLMConfigStatus(profile.id)`. If not configured, return early with `{ ok: false, error: 'not_configured', message: '...' }` — this already exists in the error union; just needs to be checked pre-flight rather than caught from the LLM layer.

---

## Section 4 — Detail Page

`JobStatsGrid` adds a fifth "Fit" cell. Renders the existing `JobFit` component with `jobId` so it stays fully interactive (assess, popover, re-assess). Same states as the row. No new components needed.

---

## Files to Change

| File | Change |
|---|---|
| `src/modules/jobs/schema.ts` | Add `trajectoryNote` to `JobFitSchema` |
| `src/modules/jobs/job-fit.ts` | Fetch onboarding context, extend prompt, add `trajectoryNote` instruction |
| `src/app/dashboard/job-applications/_components/job-fit.tsx` | Badge pill display, cold/blue for poor, expanded popover, no-key state |
| `src/app/dashboard/job-applications/view/[id]/_components/job-stats-grid.tsx` | Add Fit cell |
| `src/app/types/job-application.ts` | Update `JobFit` type if needed (likely auto from schema) |
