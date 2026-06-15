# Search Profile Redesign

**Date:** 2026-06-14
**Status:** Approved for implementation

## Problem

The current `onboardingContext` + `jobHuntSearch` dual-store model has three compounding problems:

1. **Split role management.** `targetRole` and `currentRole` are editable in both the onboarding form and the "Scan parameters" dialog on the job hunt page. Both write to `onboardingContext`. Users encounter two UIs editing the same fields with no visual connection.
2. **Structured vs. narrative entanglement.** `onboardingContext` was designed as qualitative LLM context but is also used as structured scanner config (`targetRole` → seeds `roles`, `additionalRoles` → scanner keywords). Two different concerns in one store.
3. **No progressive enrichment.** The form is filled in once and forgotten. The system learns nothing from user behaviour and has no mechanism to surface useful signals back to the user.

## Goal

A single `searchProfile` store that is the one place to configure both the job board scanner and the AI features (job-fit, chat coach, cover letter). The system progressively enriches it by queuing suggestions from observed user behaviour — accepted or dismissed at the user's pace, not mid-task.

---

## Data Model

Two new fields on `UserSettings`. Both stored as `Json?`.

### `searchProfile`

```typescript
{
  // Identity
  preferredName: string           // personalization across the app

  // Structured — feed scanner AND LLM
  currentRole: string             // current or most recent role
  roles: string[]                 // target role + aliases (primary is roles[0])
  countries: string[]             // countries of interest for job search
  remotePreference: 'remote' | 'hybrid' | 'onsite' | 'flexible' | ''
  salaryBand: {
    min: number | null
    max: number | null
    currency: string              // 'GBP', 'USD', 'EUR', etc.
  } | null

  // Narrative — LLM only, free-form
  careerGoals: string             // where they're heading, what kind of work they want
  pivotContext: string            // career change context — industry, function, role shift
  extraContext: string            // constraints, things to avoid, positioning notes
}
```

Zod schema in `src/modules/search-profile/schema.ts`. `normalizeSearchProfile(raw)` returns a fully-defaulted object (empty strings, empty arrays, null salary) — no nulls escape into product code.

### `searchSuggestions`

```typescript
Array<{
  id: string                      // nanoid
  field: keyof searchProfile      // which field this suggestion targets
  suggestedValue: unknown         // the value to apply if accepted
  reason: string                  // one-line explanation shown to the user
  source: 'job-fit' | 'chat' | 'cover-letter' | 'interview-prep'
  createdAt: string               // ISO timestamp
}>
```

Pending suggestions only. Accepted suggestions are applied and removed; dismissed suggestions are removed. No history table needed at this stage.

---

## Module: `src/modules/search-profile/`

Canonical small-module shape, mirroring `src/modules/onboarding/`:

```
src/modules/search-profile/
  schema.ts       — Zod schema, normalizeSearchProfile(), searchProfileHasContent()
  queries.ts      — getSearchProfile(profileId): SearchProfile
  actions.ts      — saveSearchProfile(), emitSuggestion(), acceptSuggestion(), dismissSuggestion()
```

### `emitSuggestion(profileId, suggestion)`

Called by any AI feature module when it detects something worth capturing. Deduplicates on `field` — if a pending suggestion for the same field already exists, skip. Keeps the queue short and low-noise.

```typescript
await emitSuggestion(profileId, {
  field: 'salaryBand',
  suggestedValue: { min: 90000, max: null, currency: 'GBP' },
  reason: 'You noted "not worth applying below 90k" while reviewing the Stripe ops role.',
  source: 'job-fit',
})
```

### `acceptSuggestion(profileId, suggestionId)`

Reads the suggestion, merges `suggestedValue` into the current `searchProfile` for the targeted field, then removes the suggestion from the queue.

### `dismissSuggestion(profileId, suggestionId)`

Removes the suggestion from the queue without modifying `searchProfile`.

---

## Search Context Page (`/dashboard/search-context`)

Rename `/dashboard/onboarding` to `/dashboard/search-context`. The route `/dashboard/onboarding` redirects to `/dashboard/search-context` for any bookmarked links.

### Layout: single page, three sections

```
┌─────────────────────────────────────────────────────┐
│  Search context                                     │
│  Used by job-fit scoring, the career coach,         │
│  and job board scanning.                            │
│                                                     │
│  ┌─ Suggestions callout (if queue non-empty) ─────┐ │
│  │  2 suggestions from your recent activity  [Review →] │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ── Identity ───────────────────────────────────── │
│  Preferred name    Current / last role              │
│                                                     │
│  ┌─ Search parameters · used for scanning + AI ──┐ │
│  │  Target roles (tag input)                      │ │
│  │  Countries (tag input)   Remote preference     │ │
│  │  Salary band (min / max / currency)            │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ Career narrative · used by AI only ──────────┐ │
│  │  Where you're heading (textarea)               │ │
│  │  Career change context (textarea, optional)    │ │
│  │  Anything else useful (textarea)               │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  [Save context]              Saved 3 days ago       │
└─────────────────────────────────────────────────────┘
```

### Suggestions inline panel

Clicking "Review →" on the callout expands an inline panel directly above the Identity section. Each suggestion shows:

- Field label + source badge (e.g. "salary band · from job-fit")
- Suggested value (human-readable, not raw JSON)
- One-line reason
- Accept / Dismiss buttons

Once all suggestions are resolved the panel collapses. The callout disappears until new suggestions arrive.

### Sidebar nav

The sidebar nav item currently labelled "Onboarding" becomes **"Search context"** in the settings section. A purple dot badge appears on the nav item when `searchSuggestions` is non-empty.

---

## LLM Consumer Updates

### Job-fit (`src/modules/jobs/job-fit.ts`)

Replace the `# Career Goals` block with `# Search context`. Structured fields add concrete signals:

```
# Search context
Target roles: Director of Operations, Head of Ops
Remote preference: remote
Countries: UK, Ireland
Salary band: £80,000–£120,000 GBP
Career goals: Director-level ops at a mission-driven tech company…
Career change context: Transitioning from agency comms into in-house tech ops…
Additional context: Avoiding VC-backed startups pre-Series B…
```

The job-fit system prompt is updated to instruct the model to populate `trajectoryNote` with any location/remote mismatch or salary mismatch it observes (e.g. "role is on-site London; your preference is remote"), in addition to career direction alignment. The `trajectoryNote` Zod type stays as `string` — the richer instruction is in the prompt, not the schema.

After scoring, `job-fit.ts` calls `emitSuggestion` in two specific cases: (1) the user's job notes contain an explicit salary floor not yet in `searchProfile.salaryBand`, or (2) the job title the user applied to contains a role type not present in `searchProfile.roles`.

### Chat coach (`src/modules/chat/context.ts`)

`buildProfileOverview` switches from `normalizeOnboardingContext` to `normalizeSearchProfile`. The profile overview gains `pivotContext` and structured fields, giving the coach the full picture without the user re-explaining their situation each session.

### Cover letter (`src/modules/cover-letter/`)

The system prompt gains awareness of `pivotContext` and `careerGoals` so the coach frames the letter opener around the user's stated direction rather than defaulting to their most recent role. Cover letter sessions call `emitSuggestion` in two specific cases: (1) the user's braindump contains an explicit salary expectation not yet in `searchProfile.salaryBand`, or (2) the braindump mentions a role type not present in `searchProfile.roles`.

### Job board scanner (`src/modules/job-hunt/`)

`getJobHuntSearch` is replaced by `getSearchProfile`. The scanner reads `roles`, `countries`, `remotePreference`, and `salaryBand.min` directly from `searchProfile`. The `SearchCriteriaBar` component on the job hunt page becomes a read-only summary with an **"Edit search context →"** link to `/dashboard/search-context`. The `ScanSettingsDialog` is removed — its fields are now on the search context page.

---

## Migration

Non-destructive, data-safe:

1. **Schema migration:** Add `searchProfile Json?` and `searchSuggestions Json?` to `UserSettings` via `npm run db:migrate -- --name add_search_profile`.

2. **Eager data migration via SQL** — included in the same Prisma migration file as the schema change. The migration script reads all `UserSettings` rows with non-null `onboardingContext` or `jobHuntSearch` and writes mapped values into `searchProfile`. This runs at deploy time before any application code, so existing users already have a populated `searchProfile` when the new code goes live. No lazy migration, no race condition.

   | Old field | New field |
   |---|---|
   | `onboardingContext.preferredName` | `searchProfile.preferredName` |
   | `onboardingContext.currentRole` | `searchProfile.currentRole` |
   | `onboardingContext.targetRole` | `searchProfile.roles[0]` |
   | `onboardingContext.additionalRoles` | `searchProfile.roles[1..]` |
   | `onboardingContext.industries` | prepended to `searchProfile.careerGoals` |
   | `onboardingContext.workPreferences` | appended to `searchProfile.extraContext` |
   | `onboardingContext.extraContext` | appended to `searchProfile.extraContext` |
   | `jobHuntSearch.locations` | `searchProfile.countries` |
   | `jobHuntSearch.minSalary` | `searchProfile.salaryBand.min` |

3. **Old columns** (`onboardingContext`, `jobHuntSearch`, `onboardingCompletedAt`, `onboardingSkippedAt`) are no longer written to after the migration. They remain in the schema as dead columns and are dropped in a follow-up cleanup migration once the release is stable.

4. **Dashboard redirect** (`/dashboard/page.tsx`): `hasSignal` check switches from `onboardingCompletedAt / onboardingSkippedAt` to `searchProfileHasContent(searchProfile)`. Because the eager SQL migration runs before code, all existing users have `searchProfile` populated on deploy — no one is incorrectly redirected to the setup page.

---

## Out of Scope

- AI-generated suggestions (the system only emits suggestions it has explicit signal for — user notes, explicit chat messages). No speculative inference from profile data alone.
- Suggestion history / audit log — pending suggestions only at this stage.
- Salary currency auto-detection — user selects currency manually.
- Multi-profile / multiple search contexts — single active profile per user.
