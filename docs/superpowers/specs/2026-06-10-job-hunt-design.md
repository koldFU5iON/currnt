# Job Hunt — Design Spec

**Date:** 2026-06-10
**Issue:** #125
**Status:** Approved

---

## Overview

A Company Watchlist feature that lets users nominate companies they're interested in. Currnt discovers each company's ATS provider, then — on user command — polls the public job board API, filters results against the user's career profile, and surfaces relevant roles in a dedicated opportunity queue. The user decides what to score and what to import into their job tracker.

Scope is deliberately narrow for Phase 1: ATS-backed companies only (Greenhouse, Lever, Ashby), manual scan trigger, user-initiated fit scoring.

---

## Data Model

Two new Prisma models. Schema files go in `prisma/schema/job-hunt.prisma`.

### `CompanyWatch`

Represents a company a user is monitoring.

```prisma
model CompanyWatch {
  id           String    @id @default(cuid())
  profileId    String
  name         String
  website      String
  careersUrl   String?
  atsProvider  String    @default("unknown")  // greenhouse | lever | ashby | unknown
  boardSlug    String?   // board/company identifier for the ATS API
  confidence   Float     @default(0)          // 0–1 detection confidence
  status       String    @default("active")   // active | paused | discovery_failed
  lastScannedAt DateTime?
  createdAt    DateTime  @default(now())

  profile       Profile         @relation(fields: [profileId], references: [id], onDelete: Cascade)
  discoveredJobs DiscoveredJob[]

  @@index([profileId])
  @@index([profileId, status])
}
```

### `DiscoveredJob`

A role found during a scan. Lives in the queue until the user imports or ignores it.

```prisma
model DiscoveredJob {
  id               String    @id @default(cuid())
  watchId          String
  profileId        String
  externalId       String    // provider's own job ID — used for dedup
  title            String
  company          String
  location         String?
  url              String?
  postedAt         DateTime? // publish date from ATS API
  description      String?   // fetched after title-match; null until then
  fitScore         Float?
  fitLabel         String?   // unlikely | weak | stretch | good | excellent
  fitJustification String?
  status           String    @default("new")  // new | scored | imported | ignored
  importedJobId    String?   // FK to JobApplication once imported
  createdAt        DateTime  @default(now())

  watch    CompanyWatch   @relation(fields: [watchId], references: [id], onDelete: Cascade)
  profile  Profile        @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([watchId, externalId])
  @@index([profileId])
  @@index([profileId, status])
  @@index([watchId])
}
```

**Key fields:**
- `externalId` + `watchId` is a unique constraint — dedup at the DB level.
- `postedAt` comes from the ATS API publish date. Displayed as role age in the UI (e.g., "Posted 4 days ago").
- `createdAt` is when Currnt discovered the job. Both dates are stored; `postedAt` is what we show as role age.
- `description` is fetched lazily — only for jobs that pass the title keyword filter.
- `importedJobId` is a soft reference (no FK constraint) to avoid cross-domain schema coupling.

---

## Module Structure

New module: `src/modules/job-hunt/`

```
schema.ts            — Zod schemas, types, ATS provider enum
queries.ts           — read queries (getWatchlist, getDiscoveredJobs, getDiscoveredJob)
actions.ts           — server actions (addCompany, scanCompany, scoreDiscoveredJob, importJob, ignoreJob, removeWatch)
ats-discovery.ts     — AI-powered careers page fetch → provider + board slug detection
profile-filter.ts    — derive keyword set from profile; filter job title list
adapters/
  index.ts           — dispatch by provider string
  greenhouse.ts      — fetch job listing from boards-api.greenhouse.io
  lever.ts           — fetch job listing from api.lever.co/v0/postings
  ashby.ts           — fetch job listing from api.ashbyhq.com/posting-api/job-board
```

### Adapter interface

Each adapter implements a single function:

```ts
type JobListing = {
  externalId: string
  title: string
  location: string | null
  url: string
  postedAt: Date | null
}

fetchJobList(boardSlug: string): Promise<JobListing[]>
```

Descriptions are NOT fetched at listing time — only titles and metadata. Full descriptions are fetched individually (one call per matched job) after the keyword filter runs.

---

## Core Flows

### Flow 1 — Add company (manual)

1. User opens "Add Company" sheet, provides name + website URL.
2. `ats-discovery.ts` fetches `{website}/careers` and `{website}/jobs` (parallel, best-effort).
3. HTML is passed to LLM with a short prompt: identify ATS provider, board slug/company slug, and the canonical careers URL. Use `completeStructured` with a tight Zod schema. Feature tag: `'job-hunt-ats-discovery'`.
4. Save `CompanyWatch` with detection result and confidence score.
5. If detection fails or provider is unsupported → `status: 'discovery_failed'`. UI shows a "Couldn't detect ATS — you can try updating the careers URL" message with a manual override input.

### Flow 2 — Add company from job capture (zero-friction path)

When `quickCaptureJob` or the job create form detects a known ATS from the URL (via existing `extract-ats.ts` logic), surface a toast after successful capture:

> **"Watch [Company] for new roles?"**  [Watch] [Dismiss]

Pre-populated with `name`, `boardSlug`, `atsProvider` from the detection result. User clicks Watch → `CompanyWatch` is created. Dismiss → nothing happens. No AI cost — board slug is already known from the URL. Consistent with the existing site toast pattern.

### Flow 3 — Scan

Triggered by user clicking "Scan Now" on a watched company.

1. Fetch job listing from ATS adapter (titles + metadata only).
2. `profile-filter.ts` derives keyword set from the user's profile (see Profile Filter section).
3. Filter listing: keep jobs where the title contains at least one keyword.
4. For matched jobs: fetch full description via individual ATS API call.
5. Dedup: skip any `externalId` already in `DiscoveredJob` for this watch.
6. Insert new `DiscoveredJob` rows with `status: 'new'`, `postedAt` from the ATS API.
7. Update `CompanyWatch.lastScannedAt`.

### Flow 4 — Score Fit (user-triggered)

User clicks "Score Fit" on a `DiscoveredJob`.

1. If `description` is null (job was title-matched but description not yet fetched), fetch it now.
2. Build profile snapshot (reuse `buildProfileSnapshot`).
3. Build prompt using the same structure as `assessJobFit` — candidate profile + role title + description.
4. Call `completeStructured` with `JobFitSchema`. Feature tag: `'job-hunt-fit'`.
5. Write `fitScore`, `fitLabel`, `fitJustification` to `DiscoveredJob`. Set `status: 'scored'`.

Reuses `JobFitSchema` directly from `src/modules/jobs/schema.ts` — no duplication.

### Flow 5 — Import

User clicks "Import" on a `DiscoveredJob`.

1. Create `JobApplication` using `DiscoveredJob` data: title, company, location → `countries`, url, description → `jobDescription`, `postedAt` → `datePublished`, applicationSource: `'cold'`.
2. If job is already scored, write fit data to `JobApplication.jobFit` + `jobFitAssessedAt`.
3. Set `DiscoveredJob.status = 'imported'`, `importedJobId = newJob.id`.
4. Revalidate `/dashboard/job-applications` and `/dashboard/job-hunt`.

### Flow 6 — Ignore

User clicks "Ignore". Sets `DiscoveredJob.status = 'ignored'`. Ignored jobs are filtered out of the default queue view but visible via a "Show ignored" toggle.

---

## Profile Filter

`profile-filter.ts` builds an expanded keyword set from existing profile data using seniority-chain expansion and role synonym normalisation. No new user input required.

### Keyword sources (in priority order)

1. `UserSettings.onboardingContext.targetRole` — primary phrase, drives seniority expansion
2. `Profile.headline` — split into meaningful tokens
3. All `ProfileExperience.title` values — past job titles reveal relevant role families
4. `ProfileSkill.name` values — technology stack keywords

### Seniority ladder expansion

A defined seniority ladder is applied to any derived keyword that contains a seniority word. When a match is found, the keyword is expanded to include adjacent levels (±2 steps on the ladder):

```ts
const SENIORITY_LADDER = [
  'intern', 'graduate', 'junior', 'jr', 'associate',
  'mid', 'engineer', 'developer',
  'senior', 'sr',
  'staff', 'lead',
  'principal', 'distinguished', 'fellow',
]
```

Example: targetRole `"Senior Software Engineer"` → seniority word is `"senior"` (index 8). Expand ±2: also generate `"mid software engineer"`, `"staff software engineer"`, `"lead software engineer"`.

The expansion is applied to the role-name component (e.g., `"software engineer"`) with each adjacent seniority prefix, producing a richer match surface.

### Role synonym map

Common equivalent terms are normalised before matching:

```ts
const ROLE_SYNONYMS: Record<string, string[]> = {
  engineer:    ['developer', 'swe', 'sde', 'programmer'],
  engineering: ['development', 'software'],
  manager:     ['mgr', 'lead', 'head of', 'director of'],
  product:     ['pm', 'pdm'],
  design:      ['ux', 'ui', 'designer'],
  data:        ['analytics', 'ml', 'machine learning', 'ai'],
}
```

Each token in a derived keyword is expanded through the synonym map, generating additional match candidates.

### Token-based matching

After expansion, each candidate keyword is split into significant tokens (stop words like "of", "and", "the" removed). A job title matches if **all significant tokens** from a candidate appear in the title (order-independent, case-insensitive).

This is stricter than simple substring matching — `"product"` alone won't match `"Senior Product Designer"` unless `"product"` is the whole derived keyword. Multi-word phrases like `"engineering manager"` must have both tokens present.

### Worked example

```
targetRole: "Senior Software Engineer"
headline:   "Senior Software Engineer"
skills:     ["TypeScript", "Node.js"]

→ base keyword: "senior software engineer"
→ seniority expansion (±2 from "senior"):
    "mid software engineer"
    "associate software engineer"
    "staff software engineer"
    "lead software engineer"
→ synonym expansion ("engineer" → "developer", "sde", "swe"):
    "senior software developer"
    "senior sde"
    "staff software developer"
    ... (all combinations)
→ tech keywords: ["typescript", "node.js"]

Matches:
  "Senior Software Engineer, Platform"  ✓ (direct)
  "Staff Software Engineer"             ✓ (seniority expansion)
  "Senior Software Developer"           ✓ (synonym expansion)
  "Senior SDE II"                       ✓ (synonym expansion)
  "TypeScript Engineer"                 ✓ (tech keyword)
  "Graduate Software Engineer"          ✓ (seniority expansion)
  "Internship — Frontend"               ✗
  "Senior Product Manager"              ✗ (no token overlap)
```

---

## ATS Discovery Prompt

`ats-discovery.ts` sends the careers page HTML to the LLM with this structured output schema:

```ts
const AtsDiscoverySchema = z.object({
  provider: z.enum(['greenhouse', 'lever', 'ashby', 'unknown']),
  boardSlug: z.string().optional(),    // e.g., "mongodb"
  careersUrl: z.string().optional(),   // canonical URL where jobs are listed
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),               // brief explanation — for debugging, not shown to user
})
```

HTML is truncated to ~8,000 characters (enough to capture embed scripts, meta tags, link hrefs) before sending to keep token cost low. Feature tag: `'job-hunt-ats-discovery'`.

---

## UI — `/dashboard/job-hunt`

### Page layout

Single page with two stacked sections:

**Watched Companies** (collapsible list, top of page):
- Each row: company name, ATS badge (Greenhouse/Lever/Ashby chip), confidence percentage, last scanned date, "Scan Now" button.
- Discovery failed state: amber warning chip + manual careers URL input.
- "Add Company" button → opens a sheet with name + website fields.
- "Watch [Company]?" inline prompt appears on the job capture flow when ATS is detected.

**Discovered Jobs** (main queue, below):
- Filter bar: by company (multi-select), by status (new / scored / all), by fit label.
- Each row:
  - Title + Company
  - Location
  - Role age: derived from `postedAt` (e.g., "Posted 4 days ago") — falls back to `createdAt` ("Found 2 days ago") if `postedAt` is null
  - Fit badge (if scored): uses existing fit label colour system
  - Actions: "Score Fit" | "Import" | "Ignore"
- Imported jobs: muted "Imported" chip, link to the job application.
- Empty state: "No new roles found. Try scanning a watched company."

### Navigation

Add "Job Hunt" to the dashboard sidebar nav, between "Job Applications" and wherever it fits contextually.

---

## LLM Usage

Two new feature tags to add to `FEATURE_LABELS` in `src/app/dashboard/settings/usage/_components/usage-log.tsx`:

| Feature tag | Label |
|---|---|
| `job-hunt-ats-discovery` | ATS Discovery |
| `job-hunt-fit` | Job Hunt Fit Score |

---

## What This Is Not

- No scheduled/automated polling in Phase 1 — always user-triggered.
- No job board aggregator integrations (LinkedIn, Indeed, IrishJobs.ie) — ATS-backed companies only.
- No auto-run fit scoring — user explicitly triggers per job.
- No application automation — user decides what to import, what to apply to.
