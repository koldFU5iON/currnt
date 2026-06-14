# Job Board Sources — Design Spec

## Goal

Extend the Job Hunt page from a company-watchlist-only tool into a full job discovery platform by adding a **Job Board Sources** column alongside the existing Watched Companies column. Both columns feed a single unified Discovered Roles queue. A universal search bar spanning all three columns drives what gets searched — roles, locations, date range, and minimum salary.

---

## Layout

Three-column grid with a full-width search bar above it:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Roles [tags]    │  Locations [tags]  │  Date Posted  │  Min Salary │ Apply │
└─────────────────────────────────────────────────────────────────────┘
┌──────────────────┬────────────────────┬─────────────────────────────┐
│ Watched Companies│  Job Board Sources │     Discovered Roles        │
│                  │                    │                             │
│  MongoDB  [Scan] │  ── Free ──        │  [All][Company][Boards]     │
│  Stripe   [Scan] │  Remotive  ⚙ [Scan]│                             │
│  Linear   [Scan] │  RemoteOK  ⚙ [Scan]│  Sr Eng Mgr · MongoDB ···  │
│                  │  Adzuna    ⚙ [Scan]│  Ops Mgr · via Remotive ···│
│  + Add Company   │  ── Paid ──        │  Program Mgr · Linear ·····│
│                  │  JSearch 🔑        │                             │
│                  │  ── Manual ──      │                             │
│                  │  Hitmarker →       │                             │
│                  │  GamesJobsDirect → │                             │
└──────────────────┴────────────────────┴─────────────────────────────┘
```

**Sync All** button (top-right header) triggers scans across both column 1 and column 2 simultaneously.

---

## Universal Search Bar

Stored in `UserSettings.jobHuntSearch` as JSON. Auto-seeded from `onboardingContext.targetRole` on first visit.

| Field | Type | Notes |
|---|---|---|
| `roles` | `string[]` | Multi-tag input. Reuses `role-aliases-input.tsx`. |
| `locations` | `string[]` | Multi-tag input. Reuses `location-tags-input.tsx`. |
| `datePosted` | `'last7' \| 'last30' \| 'last90' \| 'any'` | Dropdown select. |
| `minSalary` | `number \| null` | Plain number input with `+` suffix. Passed as API parameter where supported. |

Clicking **Apply** calls `saveJobHuntSearch` server action and `router.refresh()`.

---

## Data Model

### New model: `JobBoardSource`

```prisma
model JobBoardSource {
  id            String    @id @default(cuid())
  profileId     String
  provider      String    // 'remotive' | 'remoteok' | 'adzuna' | 'jsearch' | 'web-search' (reserved, Issue #216)
  enabled       Boolean   @default(true)
  lastScannedAt DateTime?
  createdAt     DateTime  @default(now())

  profile        Profile         @relation(fields: [profileId], references: [id], onDelete: Cascade)
  discoveredJobs DiscoveredJob[]

  @@unique([profileId, provider])
  @@index([profileId])
}
```

Sources are seeded automatically (`ensureBoardSources`) on first page load — one row per known provider per profile. This is idempotent: `upsert` with `update: {}`.

### Modified: `DiscoveredJob`

- `watchId` → `String?` (nullable — board-source jobs have no CompanyWatch)
- `boardSourceId String?` added — FK to `JobBoardSource`
- `salary String?` added — raw salary string from board API where available
- `@@unique([watchId, externalId])` retained (Postgres treats NULLs as distinct, so board rows don't conflict)
- `@@unique([boardSourceId, externalId])` added

App-level dedup (checking `existingIds` before `createMany`) is the primary guard for both source types.

### Modified: `UserSettings`

- `jobHuntSearch Json?` — shape: `JobHuntSearchCriteria` (see schema.ts)
- `jobBoardApiKeys Json?` — shape: `{ jsearch?: string }` where each value is AES-GCM encrypted

---

## Board Adapters

All live in `src/modules/job-hunt/board-adapters/`. Interface:

```ts
type BoardAdapter = {
  isAvailable(): boolean  // returns false if required env/keys missing
  fetchJobs(criteria: BoardSearchCriteria, apiKey?: string): Promise<BoardJobListing[]>
}

type BoardJobListing = {
  externalId: string
  title: string
  company: string    // boards return company name; ATS adapters don't need it
  location: string | null
  url: string
  postedAt: Date | null
  salary: string | null
}
```

| Provider | Auth | Coverage | Notes |
|---|---|---|---|
| **Remotive** | None | Remote tech globally | `search` param, post-filter by role match |
| **RemoteOK** | None | Remote globally | `tags` param, first element is metadata skip it |
| **Adzuna** | App-level env: `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | IE, UK, FR, US — broad aggregation | One request per location (mapped to country code) |
| **JSearch** | User RapidAPI key (encrypted in UserSettings) | LinkedIn + Indeed + Glassdoor globally | `query` = role + location, `date_posted` param |

`isAvailable()`:
- Remotive / RemoteOK: always true
- Adzuna: `!!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)`
- JSearch: true only when called with a non-null apiKey

---

## Settings: Job Boards Page

New page at `/dashboard/settings/job-boards`.

- **Adzuna** section: read-only status chip — shows "Configured" if env vars present, "Not available" if missing. No user action.
- **JSearch (RapidAPI)** section: password-style API key input, save button (encrypts with AES-GCM matching LLM key pattern), clear button. Shows "Configured" badge when key is saved.

Link added to settings index page alongside LLM, Account, etc.

---

## Manual Sources Tile

In the Job Board Sources column, below the automated sources. A static list of curated boards that have no API, grouped by vertical. Each row is a plain link that opens the board in a new tab — a clear call-to-action to use the existing bookmarklet for manual capture.

Verticals: Gaming, Comms/PR/Marketing, Ireland, Executive Search.

---

## Discovered Roles Column Changes

- **Filter tabs**: All | Company | Boards | Scored
- **Source pill** on each job row: purple `company` or green `board`
- **Salary tag** (green) where `salary` is non-null
- `getDiscoveredJobs` updated to include both `watch` (nullable) and `boardSource` (nullable)
- `job-queue-row.tsx` updated to derive company name from `job.company` (already a field) and show source type

---

## Sync All

`scanAll()` action extended to:
1. Scan all active `CompanyWatch` rows (existing behaviour)
2. Scan all enabled `JobBoardSource` rows (new)
3. Return merged totals: `{ scanned, newJobs, failed }`

`SyncAllButton` toast message updated to reflect both source types.

---

## What Is Not In Scope

- **Web search adapter** (`web-search` provider) — reserved as a schema slot, tracked in Issue #216
- Reed.co.uk adapter — Adzuna covers UK; Reed can be added as a third-party adapter later with no schema changes
- Wellfound adapter — same, addable later
- Scheduled/automatic syncing — all scans are manual triggers for now
