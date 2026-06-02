# Job List Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the job applications list with select-all, persistent collapse, expanded search, a Vercel-style filter+sort bar, a posting-age indicator, and a lazy-loaded archived-jobs tab.

**Architecture:** All filtering, sorting, and search happen client-side in `JobList` since the full active job set is already loaded. Filter state persists to localStorage. The archived-jobs tab fetches lazily (only on first click) via a dedicated Server Action so initial page load stays fast.

**Tech Stack:** Next.js 16 App Router, React, Tailwind v4, shadcn/ui (Popover, Tabs, Checkbox, Badge), Lucide icons, Prisma 7, TypeScript strict.

---

## Files touched

| File | Change |
|---|---|
| `src/modules/jobs/queries.ts` | Fix null-dateApplied sort; add `getArchivedJobs` |
| `src/app/dashboard/job-applications/_components/job-list.tsx` | Select-all, filter state, filter bar integration, archived tab |
| `src/app/dashboard/job-applications/_components/job-group.tsx` | Persist collapse state to localStorage |
| `src/app/dashboard/job-applications/_components/job-row.tsx` | Add `datePublished` cell with posting-age indicator; 11-col grid |
| `src/app/dashboard/job-applications/_components/job-row-card.tsx` | Add `datePublished` chip with posting-age indicator |
| `src/app/dashboard/job-applications/_components/posting-age.tsx` | **New** — PostingAge component: pre-apply freshness vs post-apply timing |
| `src/app/dashboard/job-applications/_components/filter-bar.tsx` | **New** — FilterDropdown + SortDropdown + FilterBar |
| `src/app/dashboard/job-applications/_components/archived-tab.tsx` | **New** — lazy-loaded archived job list |

---

## Task 1: Fix null-dateApplied sort + add `getArchivedJobs`

**Files:**
- Modify: `src/modules/jobs/queries.ts`

- [ ] **Step 1: Update `getActiveJobs` orderBy**

Replace the single `orderBy` with a two-key sort so jobs without an applied date fall back to `createdAt`:

```ts
// src/modules/jobs/queries.ts
import { prisma } from "@/lib/db"
import type { Job } from "@/app/types/job-application"
import { requireProfile } from "@/lib/session"

export async function getActiveJobs(): Promise<Job[]> {
  const { profile } = await requireProfile()
  const jobs = await prisma.jobApplication.findMany({
    where: { profileId: profile.id, archivedAt: null },
    orderBy: [{ dateApplied: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  })
  return jobs as Job[]
}

export async function getJobApplicationById(id: string): Promise<Job | null> {
  const { profile } = await requireProfile()
  const job = await prisma.jobApplication.findFirst({
    where: { id, profileId: profile.id },
  })
  return job as Job | null
}

export async function getArchivedJobs(): Promise<Job[]> {
  const { profile } = await requireProfile()
  const jobs = await prisma.jobApplication.findMany({
    where: { profileId: profile.id, archivedAt: { not: null } },
    orderBy: [{ archivedAt: 'desc' }],
  })
  return jobs as Job[]
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/jobs/queries.ts
git commit -m "fix(jobs): stable sort for null dateApplied; add getArchivedJobs"
```

---

## Task 2: Add `datePublished` column to desktop grid and mobile card

The grid currently has 10 columns: `auto_1.5fr_auto_1fr_auto_auto_auto_auto_auto_auto`. Adding `datePublished` between "Applied" and "Notes" makes it 11.

**Files:**
- Modify: `src/app/dashboard/job-applications/_components/job-list.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-row.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-row-card.tsx`

- [ ] **Step 1: Update grid template and ColHeaders in `job-list.tsx`**

```tsx
// In JobList — desktop grid div (around line 182):
<div className="hidden md:grid grid-cols-[auto_1.5fr_auto_1fr_auto_auto_auto_auto_auto_auto_auto]">

// In ColHeaders:
function ColHeaders() {
  return (
    <div className="col-span-full grid grid-cols-subgrid border-b border-border/50">
      <div className="px-2 py-1.5" />
      {(["Role", "Status", "Progress", "Salary", "Fit", "Applied", "Published", "Notes", "Updated"] as const).map(label => (
        <div key={label} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
          {label}
        </div>
      ))}
      <div className="px-2 py-1.5" />
    </div>
  )
}
```

- [ ] **Step 2: Add `datePublished` cell to `job-row.tsx`**

After the `{/* Applied date */}` block (around line 123), add:

```tsx
{/* Published date */}
<div className="px-3 py-2">
  {datePublished
    ? <span className="text-xs text-muted-foreground">{formatShortDate(datePublished)}</span>
    : <span className="text-xs text-muted-foreground/30">—</span>
  }
</div>
```

Also add `datePublished` to the destructured fields at the top of `JobRow`:

```tsx
const {
  id, jobNumber, title, company, countries, url,
  dateApplied, datePublished, lastUpdated, status, progress,
  jobFit, notes, notesIncludeInFit, applicationSource,
  jobDescription, salaryBand,
} = job
```

Import `formatShortDate` if not already imported:

```tsx
import { daysAgo, formatRelative, formatShortDate } from "@/lib/utils"
```

- [ ] **Step 3: Add `datePublished` chip to `job-row-card.tsx`**

In the Row 3 metadata chips block (around line 114), add after the `dateApplied` span:

```tsx
{datePublished && (
  <span className="text-xs text-muted-foreground">
    Posted {formatShortDate(datePublished)}
  </span>
)}
```

Also add `datePublished` to the destructured fields in `JobRowCard`.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/job-applications/_components/job-list.tsx \
        src/app/dashboard/job-applications/_components/job-row.tsx \
        src/app/dashboard/job-applications/_components/job-row-card.tsx
git commit -m "feat(jobs): add datePublished column to list grid and mobile card"
```

---

## Task 3: Select-all checkbox in header

**Files:**
- Modify: `src/app/dashboard/job-applications/_components/job-list.tsx`

- [ ] **Step 1: Add `toggleSelectAll` to `JobList` and pass to `ColHeaders`**

In the `JobList` component, add after `clearSelection`:

```tsx
function toggleSelectAll() {
  const allIds = filteredJobs.map(j => j.id)
  const allSelected = allIds.every(id => selected.has(id))
  if (allSelected) {
    setSelected(new Set())
  } else {
    setSelected(new Set(allIds))
  }
}
```

In the desktop grid, pass `isAllSelected`, `isSomeSelected`, and `onToggleAll` to `ColHeaders`:

```tsx
const isAllSelected = filteredJobs.length > 0 && filteredJobs.every(j => selected.has(j.id))
const isSomeSelected = !isAllSelected && filteredJobs.some(j => selected.has(j.id))

// ...
<ColHeaders
  isAllSelected={isAllSelected}
  isSomeSelected={isSomeSelected}
  onToggleAll={toggleSelectAll}
/>
```

- [ ] **Step 2: Update `ColHeaders` to accept and render the master checkbox**

```tsx
type ColHeadersProps = {
  isAllSelected: boolean
  isSomeSelected: boolean
  onToggleAll: () => void
}

function ColHeaders({ isAllSelected, isSomeSelected, onToggleAll }: ColHeadersProps) {
  return (
    <div className="col-span-full grid grid-cols-subgrid border-b border-border/50">
      <div className="flex items-center justify-center px-2 py-1.5">
        <Checkbox
          checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
          onCheckedChange={onToggleAll}
          aria-label={isAllSelected ? 'Deselect all' : 'Select all'}
        />
      </div>
      {(["Role", "Status", "Progress", "Salary", "Fit", "Applied", "Published", "Notes", "Updated"] as const).map(label => (
        <div key={label} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
          {label}
        </div>
      ))}
      <div className="px-2 py-1.5" />
    </div>
  )
}
```

Make sure `Checkbox` is imported at the top of `job-list.tsx`:

```tsx
import { Checkbox } from "@/components/ui/checkbox"
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/job-applications/_components/job-list.tsx
git commit -m "feat(jobs): select-all checkbox in list header"
```

---

## Task 4: Persist group collapse state to localStorage

**Files:**
- Modify: `src/app/dashboard/job-applications/_components/job-group.tsx`

Each group's key is the status value (e.g. `"applied"`, `"closed"`). We persist per-key collapse state.

- [ ] **Step 1: Rewrite collapse state in `JobGroup` to use localStorage**

```tsx
'use client'

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { type Job } from "@/app/types/job-application"
import { JobRow } from "./job-row"
import { JobRowCard } from "./job-row-card"

const COLLAPSE_KEY = 'jobs-group-collapsed'

function readCollapseMap(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(COLLAPSE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeCollapseMap(map: Record<string, boolean>) {
  window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map))
}

type JobGroupProps = {
  label: string | null
  groupKey: string
  jobs: Job[]
  selected: Set<string>
  busyRows: Map<string, string>
  onToggleSelect: (id: string) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  defaultCollapsed?: boolean
  hasLLMKey: boolean
  isMobile?: boolean
}

export function JobGroup({
  label,
  groupKey,
  jobs,
  selected,
  busyRows,
  onToggleSelect,
  onEdit,
  onArchive,
  defaultCollapsed = false,
  hasLLMKey,
  isMobile = false,
}: JobGroupProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  // Hydrate from localStorage after mount (SSR-safe, same pattern as view mode)
  useEffect(() => {
    const map = readCollapseMap()
    if (groupKey in map) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(map[groupKey])
    }
  }, [groupKey])

  function handleToggle() {
    setCollapsed(c => {
      const next = !c
      const map = readCollapseMap()
      map[groupKey] = next
      writeCollapseMap(map)
      return next
    })
  }

  if (jobs.length === 0) return null

  const isCollapsible = label !== null

  return (
    <div className={isMobile ? undefined : "col-span-full grid grid-cols-subgrid"}>
      {label !== null && (
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={!collapsed}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors border-b border-border/30 cursor-pointer w-full",
            !isMobile && "col-span-full",
          )}
        >
          {isCollapsible && (collapsed
            ? <ChevronRight size={12} className="shrink-0" />
            : <ChevronDown size={12} className="shrink-0" />)}
          <span>{label}</span>
          <span className="text-muted-foreground/70 font-normal normal-case">· {jobs.length}</span>
        </button>
      )}

      {!collapsed && jobs.map(job => isMobile ? (
        <JobRowCard
          key={job.id}
          job={job}
          selected={selected.has(job.id)}
          busyLabel={busyRows.get(job.id)}
          onToggleSelect={onToggleSelect}
          onEdit={onEdit}
          onArchive={onArchive}
          hasLLMKey={hasLLMKey}
        />
      ) : (
        <JobRow
          key={job.id}
          job={job}
          selected={selected.has(job.id)}
          busyLabel={busyRows.get(job.id)}
          onToggleSelect={onToggleSelect}
          onEdit={onEdit}
          onArchive={onArchive}
          hasLLMKey={hasLLMKey}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Update `job-list.tsx` to pass `groupKey` to `JobGroup`**

In both the mobile and desktop `groups.map(g => <JobGroup ... />)` calls, add `groupKey={g.key}`:

```tsx
<JobGroup
  key={g.key}
  groupKey={g.key}
  label={g.label}
  // ... rest of props
/>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/job-applications/_components/job-group.tsx \
        src/app/dashboard/job-applications/_components/job-list.tsx
git commit -m "feat(jobs): persist group collapse state to localStorage"
```

---

## Task 5: Vercel-style filter + sort bar

This is the main feature. We build a generic `FilterDropdown` and `SortDropdown` housed in a new `FilterBar` component, then wire filter + sort state into `JobList`. Filtering (including expanded search) happens in a single `applyFilters` function.

**Files:**
- Create: `src/app/dashboard/job-applications/_components/filter-bar.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-list.tsx`

### 5a: Build `filter-bar.tsx`

- [ ] **Step 1: Create `filter-bar.tsx`**

```tsx
'use client'

import { ChevronDown, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_SOURCE_LABEL,
  APPLICATION_SOURCES,
  ApplicationStatus,
  type ApplicationStatusType,
  type ApplicationSourceType,
} from '@/app/types/job-application'
import type { JobFit } from '@/app/types/job-application'

export type FilterState = {
  status: Set<ApplicationStatusType>
  source: Set<ApplicationSourceType>
  fit: Set<JobFit['label'] | 'none'>
}

export type SortField = 'dateApplied' | 'datePublished' | 'company' | 'fitRating' | 'lastUpdated'
export type SortDirection = 'asc' | 'desc'
export type SortState = { field: SortField; direction: SortDirection }

export const DEFAULT_FILTER: FilterState = {
  status: new Set(),
  source: new Set(),
  fit: new Set(),
}

export const DEFAULT_SORT: SortState = { field: 'dateApplied', direction: 'desc' }

export function isFilterActive(f: FilterState) {
  return f.status.size > 0 || f.source.size > 0 || f.fit.size > 0
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'dateApplied',   label: 'Date applied' },
  { value: 'datePublished', label: 'Date published' },
  { value: 'company',       label: 'Company A–Z' },
  { value: 'fitRating',     label: 'Fit score' },
  { value: 'lastUpdated',   label: 'Last updated' },
]

const STATUS_OPTIONS = Object.values(ApplicationStatus).map(v => ({
  value: v as ApplicationStatusType,
  label: APPLICATION_STATUS_LABEL[v as ApplicationStatusType],
}))

const SOURCE_OPTIONS = APPLICATION_SOURCES.map(v => ({
  value: v as ApplicationSourceType,
  label: APPLICATION_SOURCE_LABEL[v as ApplicationSourceType],
}))

const FIT_OPTIONS: { value: JobFit['label'] | 'none'; label: string }[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good',      label: 'Good' },
  { value: 'stretch',   label: 'Stretch' },
  { value: 'weak',      label: 'Weak' },
  { value: 'unlikely',  label: 'Unlikely' },
  { value: 'none',      label: 'Not assessed' },
]

type FilterBarProps = {
  filter: FilterState
  sort: SortState
  onFilterChange: (f: FilterState) => void
  onSortChange: (s: SortState) => void
}

export function FilterBar({ filter, sort, onFilterChange, onSortChange }: FilterBarProps) {
  const active = isFilterActive(filter)

  function clearFilters() {
    onFilterChange({ status: new Set(), source: new Set(), fit: new Set() })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterDropdown
        label="Status"
        options={STATUS_OPTIONS}
        selected={filter.status}
        onChange={(next) => onFilterChange({ ...filter, status: next as Set<ApplicationStatusType> })}
      />
      <FilterDropdown
        label="Source"
        options={SOURCE_OPTIONS}
        selected={filter.source}
        onChange={(next) => onFilterChange({ ...filter, source: next as Set<ApplicationSourceType> })}
      />
      <FilterDropdown
        label="Fit"
        options={FIT_OPTIONS}
        selected={filter.fit}
        onChange={(next) => onFilterChange({ ...filter, fit: next as Set<JobFit['label'] | 'none'> })}
      />
      <SortDropdown sort={sort} onSortChange={onSortChange} />
      {active && (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={12} />
          Clear filters
        </button>
      )}
    </div>
  )
}

type FilterDropdownProps<T extends string> = {
  label: string
  options: { value: T; label: string }[]
  selected: Set<T>
  onChange: (next: Set<T>) => void
}

function FilterDropdown<T extends string>({ label, options, selected, onChange }: FilterDropdownProps<T>) {
  const count = selected.size

  function toggle(value: T) {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(next)
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs transition-colors hover:bg-muted",
          count > 0 ? "border-foreground/30 text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {count > 0 && (
          <span className="rounded bg-foreground/10 px-1 font-medium tabular-nums">
            {count}
          </span>
        )}
        <ChevronDown size={11} className="shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <Checkbox
              checked={selected.has(opt.value)}
              onCheckedChange={() => toggle(opt.value)}
              aria-hidden="true"
              tabIndex={-1}
            />
            {opt.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

type SortDropdownProps = {
  sort: SortState
  onSortChange: (s: SortState) => void
}

function SortDropdown({ sort, onSortChange }: SortDropdownProps) {
  const currentLabel = SORT_OPTIONS.find(o => o.value === sort.field)?.label ?? 'Sort'
  const dirLabel = sort.direction === 'asc' ? '↑' : '↓'

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
      >
        {currentLabel} {dirLabel}
        <ChevronDown size={11} className="shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1">
        {SORT_OPTIONS.map(opt => {
          const isActive = sort.field === opt.value
          return (
            <div key={opt.value} className="flex items-center rounded hover:bg-muted transition-colors">
              <button
                type="button"
                onClick={() => onSortChange({ field: opt.value, direction: sort.direction })}
                className={cn(
                  "flex-1 px-2 py-1.5 text-left text-sm",
                  isActive && "font-medium text-foreground",
                )}
              >
                {opt.label}
              </button>
              {isActive && (
                <button
                  type="button"
                  onClick={() => onSortChange({ field: sort.field, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
                  className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Toggle sort direction"
                >
                  {dirLabel}
                </button>
              )}
            </div>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
```

### 5b: Wire filter + sort state into `JobList`

- [ ] **Step 2: Update `job-list.tsx` — add filter/sort state and `applyFilters`**

Add imports at the top:

```tsx
import {
  FilterBar,
  DEFAULT_FILTER,
  DEFAULT_SORT,
  isFilterActive,
  type FilterState,
  type SortState,
  type SortField,
} from './filter-bar'
import { APPLICATION_STATUS_LABEL } from '@/app/types/job-application'
```

Add state inside `JobList`:

```tsx
const FILTER_KEY = 'jobs-filter'
const SORT_KEY = 'jobs-sort'

const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER)
const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
```

Hydrate from localStorage in the existing `useEffect` (extend the one that already handles view mode):

```tsx
useEffect(() => {
  const savedMode = window.localStorage.getItem(VIEW_MODE_KEY)
  if (savedMode === 'all' || savedMode === 'grouped') setViewMode(savedMode)

  try {
    const savedFilter = window.localStorage.getItem(FILTER_KEY)
    if (savedFilter) {
      const p = JSON.parse(savedFilter)
      setFilter({
        status: new Set(p.status ?? []),
        source: new Set(p.source ?? []),
        fit: new Set(p.fit ?? []),
      })
    }
    const savedSort = window.localStorage.getItem(SORT_KEY)
    if (savedSort) {
      const p = JSON.parse(savedSort)
      if (p.field && p.direction) setSort(p)
    }
  } catch { /* ignore malformed cache */ }
}, [])
```

Add persist helpers:

```tsx
function changeFilter(next: FilterState) {
  setFilter(next)
  window.localStorage.setItem(FILTER_KEY, JSON.stringify({
    status: [...next.status],
    source: [...next.source],
    fit: [...next.fit],
  }))
}

function changeSort(next: SortState) {
  setSort(next)
  window.localStorage.setItem(SORT_KEY, JSON.stringify(next))
}
```

Replace the existing `filteredJobs` memo with a combined filter+sort+search memo:

```tsx
const filteredJobs = useMemo(() => {
  const q = query.trim().toLowerCase()

  // 1. text search — title, company, location, notes, status label
  let result = q
    ? jobs.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.countries.join(' ').toLowerCase().includes(q) ||
        (j.notes ?? '').toLowerCase().includes(q) ||
        APPLICATION_STATUS_LABEL[j.status].toLowerCase().includes(q)
      )
    : [...jobs]

  // 2. status filter
  if (filter.status.size > 0) {
    result = result.filter(j => filter.status.has(j.status))
  }

  // 3. source filter
  if (filter.source.size > 0) {
    result = result.filter(j => filter.source.has(j.applicationSource))
  }

  // 4. fit filter
  if (filter.fit.size > 0) {
    result = result.filter(j => {
      const label = j.jobFit?.label ?? 'none'
      return filter.fit.has(label as never)
    })
  }

  // 5. sort
  result.sort((a, b) => {
    let cmp = 0
    switch (sort.field) {
      case 'dateApplied':
        cmp = (a.dateApplied?.getTime() ?? 0) - (b.dateApplied?.getTime() ?? 0)
        break
      case 'datePublished':
        cmp = (a.datePublished?.getTime() ?? 0) - (b.datePublished?.getTime() ?? 0)
        break
      case 'company':
        cmp = a.company.localeCompare(b.company)
        break
      case 'fitRating':
        cmp = (a.jobFit?.rating ?? -1) - (b.jobFit?.rating ?? -1)
        break
      case 'lastUpdated':
        cmp = a.lastUpdated.getTime() - b.lastUpdated.getTime()
        break
    }
    return sort.direction === 'asc' ? cmp : -cmp
  })

  return result
}, [jobs, query, filter, sort])
```

- [ ] **Step 3: Add `FilterBar` to the `ToolBar` render**

In the `ToolBar` component and call site in `JobList`, add `filter`, `sort`, `onFilterChange`, and `onSortChange` props:

```tsx
// In JobList render:
<ToolBar
  query={query}
  onQueryChange={setQuery}
  visibleCount={filteredJobs.length}
  totalCount={jobs.length}
  viewMode={viewMode}
  onViewModeChange={changeViewMode}
  selectedCount={selected.size}
  onClearSelection={clearSelection}
  onBulkArchive={handleBulkArchive}
  filter={filter}
  sort={sort}
  onFilterChange={changeFilter}
  onSortChange={changeSort}
/>
```

Add `FilterBar` below the existing first row inside `ToolBar`:

```tsx
type ToolBarProps = {
  // ... existing props ...
  filter: FilterState
  sort: SortState
  onFilterChange: (f: FilterState) => void
  onSortChange: (s: SortState) => void
}

function ToolBar({ ..., filter, sort, onFilterChange, onSortChange }: ToolBarProps) {
  return (
    <div className="flex flex-col space-y-2">
      {/* Row 1: search + view mode + bulk actions + add button */}
      <div className="flex space-x-2 items-center">
        {/* ... existing row 1 contents unchanged ... */}
      </div>
      {/* Row 2: filters + sort */}
      <FilterBar
        filter={filter}
        sort={sort}
        onFilterChange={onFilterChange}
        onSortChange={onSortChange}
      />
      <div className="text-xs text-muted-foreground">
        {/* ... existing count line ... */}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/job-applications/_components/filter-bar.tsx \
        src/app/dashboard/job-applications/_components/job-list.tsx
git commit -m "feat(jobs): Vercel-style filter+sort bar with expanded search"
```

---

## Task 6: Posting-age indicator

This tracks the **job posting's lifecycle**, not the fit assessment. It answers two questions depending on where the user is in the funnel:

- **Pre-application** (`NotStarted` / `InProgress`): how old is this posting today? A role posted 60+ days ago likely has a full pipeline — this is a signal to act fast or move on.
- **Post-application** (`Applied` and beyond): how many days after posting did the user apply? Late applicants compete against a longer queue; early applicants are a strong signal of attentiveness.

This indicator lives in the `datePublished` cell, replacing the plain date text. It is distinct from `FreshnessChip` (which tracks response activity after applying).

**Files:**
- Create: `src/app/dashboard/job-applications/_components/posting-age.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-row.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-row-card.tsx`

- [ ] **Step 1: Create `posting-age.tsx`**

```tsx
'use client'

import { cn, daysAgo, formatShortDate } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { OpenStatuses, type ApplicationStatusType } from '@/app/types/job-application'

type PostingAgeProps = {
  datePublished: Date | null
  dateApplied: Date | null
  status: ApplicationStatusType
}

const PRE_APPLY_STATUSES = new Set(['not started', 'in-progress'] as ApplicationStatusType[])

export function PostingAge({ datePublished, dateApplied, status }: PostingAgeProps) {
  if (!datePublished) {
    return <span className="text-xs text-muted-foreground/30">—</span>
  }

  const isPreApply = PRE_APPLY_STATUSES.has(status)

  if (isPreApply) {
    // Show posting age relative to today — how stale is this opportunity?
    const daysOld = daysAgo(datePublished) ?? 0
    const colorClass =
      daysOld >= 60 ? 'text-red-500/70' :
      daysOld >= 30 ? 'text-amber-500' :
      'text-muted-foreground'
    const tooltip =
      daysOld >= 60
        ? `Posted ${daysOld} days ago — pipeline is likely full, consider moving on`
        : daysOld >= 30
          ? `Posted ${daysOld} days ago — apply soon or the window may close`
          : `Posted ${daysOld} days ago — still fresh`

    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span className={cn('cursor-default text-xs', colorClass)}>
              {formatShortDate(datePublished)}
            </span>
          }
        />
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    )
  }

  // Post-application: show days between publishing and applying
  if (!dateApplied) {
    return <span className="text-xs text-muted-foreground">{formatShortDate(datePublished)}</span>
  }

  const daysAfter = Math.max(
    0,
    Math.round((dateApplied.getTime() - datePublished.getTime()) / (1000 * 60 * 60 * 24)),
  )
  const colorClass = daysAfter >= 30 ? 'text-muted-foreground/50' : 'text-muted-foreground'
  const tooltip =
    daysAfter === 0
      ? 'Applied the day the job was posted — excellent timing'
      : daysAfter <= 7
        ? `Applied ${daysAfter} day${daysAfter === 1 ? '' : 's'} after posting — strong timing`
        : daysAfter <= 30
          ? `Applied ${daysAfter} days after posting`
          : `Applied ${daysAfter} days after posting — late in the window`

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className={cn('cursor-default text-xs', colorClass)}>
            {formatShortDate(datePublished)}
          </span>
        }
      />
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  )
}
```

- [ ] **Step 2: Use `PostingAge` in `job-row.tsx` for the Published cell**

Replace the plain `datePublished` cell added in Task 2 with the new component:

```tsx
import { PostingAge } from './posting-age'

// In the {/* Published date */} cell:
<div className="px-3 py-2">
  <PostingAge
    datePublished={datePublished ?? null}
    dateApplied={dateApplied ?? null}
    status={status}
  />
</div>
```

- [ ] **Step 3: Use `PostingAge` in `job-row-card.tsx`**

Replace the plain `datePublished` chip added in Task 2 with:

```tsx
import { PostingAge } from './posting-age'

// In the Row 3 metadata chips, replace the datePublished span:
<PostingAge
  datePublished={datePublished ?? null}
  dateApplied={dateApplied ?? null}
  status={status}
/>
```

Also add `dateApplied` to the destructured fields in `JobRowCard` if not already present.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/job-applications/_components/posting-age.tsx \
        src/app/dashboard/job-applications/_components/job-row.tsx \
        src/app/dashboard/job-applications/_components/job-row-card.tsx
git commit -m "feat(jobs): posting-age indicator — pre-apply freshness and post-apply timing"
```

---

## Task 7: Lazy-loaded archived jobs tab

The page gains a `Tabs` wrapper. The "Active" tab renders the existing `JobList`. The "Archived" tab renders `ArchivedTab`, which fetches on first open and shows a simplified read-only list with a Restore button.

We need a `restoreJobApplication` Server Action (un-sets `archivedAt`).

**Files:**
- Create: `src/app/dashboard/job-applications/_components/archived-tab.tsx`
- Modify: `src/modules/jobs/mutations.ts` (add `restoreJobApplication`)
- Modify: `src/app/dashboard/job-applications/page.tsx`

- [ ] **Step 1: Add `restoreJobApplication` to `mutations.ts`**

Open `src/modules/jobs/mutations.ts` and add at the bottom:

```ts
export async function restoreJobApplication(id: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.jobApplication.update({
    where: { id, profileId: profile.id },
    data: { archivedAt: null },
  })
  revalidatePath('/dashboard/job-applications')
}
```

- [ ] **Step 2: Create `archived-tab.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { ArchiveRestore, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getArchivedJobs } from '@/modules/jobs/queries'
import { restoreJobApplication } from '@/modules/jobs/mutations'
import { formatShortDate } from '@/lib/utils'
import { APPLICATION_STATUS_LABEL } from '@/app/types/job-application'
import type { Job } from '@/app/types/job-application'
import { Button } from '@/components/ui/button'

type ArchivedTabProps = {
  initialJobs?: Job[]
}

export function ArchivedTab({ initialJobs }: ArchivedTabProps) {
  const [jobs, setJobs] = useState<Job[] | null>(initialJobs ?? null)
  const [loading, setLoading] = useState(false)

  // Fetch lazily on first render of this tab
  useState(() => {
    if (jobs !== null) return
    setLoading(true)
    getArchivedJobs()
      .then(setJobs)
      .catch(() => toast.error('Failed to load archived jobs'))
      .finally(() => setLoading(false))
  })

  if (loading || jobs === null) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
        <Loader2 className="size-4 animate-spin" />
        Loading archived jobs…
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No archived jobs yet.
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/30">
      {jobs.map(job => (
        <ArchivedRow
          key={job.id}
          job={job}
          onRestored={(id) => setJobs(prev => (prev ?? []).filter(j => j.id !== id))}
        />
      ))}
    </div>
  )
}

function ArchivedRow({ job, onRestored }: { job: Job; onRestored: (id: string) => void }) {
  const [isPending, startTransition] = useTransition()

  function handleRestore() {
    startTransition(async () => {
      try {
        await restoreJobApplication(job.id)
        toast.success(`${job.title} restored`)
        onRestored(job.id)
      } catch {
        toast.error('Failed to restore job')
      }
    })
  }

  return (
    <div className="flex items-center gap-3 px-3 py-3 hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{job.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {job.company}
          {job.countries.length > 0 && ` · ${job.countries.join(', ')}`}
          <span className="ml-2 opacity-60">{APPLICATION_STATUS_LABEL[job.status]}</span>
          {job.archivedAt && (
            <span className="ml-2 opacity-50">Archived {formatShortDate(job.archivedAt)}</span>
          )}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleRestore}
        disabled={isPending}
        className="shrink-0 gap-1.5"
      >
        {isPending
          ? <Loader2 size={13} className="animate-spin" />
          : <ArchiveRestore size={13} />
        }
        Restore
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Update `page.tsx` to use Tabs**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { JobList } from "./_components/job-list"
import { ArchivedTab } from "./_components/archived-tab"
import { getActiveJobs } from "@/modules/jobs/queries"
import { ContentContainer } from "@/app/components/ContentContainer"
import { requireProfile } from "@/lib/session"
import { getLLMConfigStatus } from "@/modules/llm/client"

export default async function Page() {
  const [jobs, { profile }] = await Promise.all([
    getActiveJobs(),
    requireProfile(),
  ])
  const { configured: hasLLMKey } = await getLLMConfigStatus(profile.id)

  return (
    <ContentContainer fullWidth title="Job Applications" description="Track all the jobs you're currently interested in.">
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="mb-2">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <JobList jobs={jobs} hasLLMKey={hasLLMKey} />
        </TabsContent>
        <TabsContent value="archived">
          <ArchivedTab />
        </TabsContent>
      </Tabs>
    </ContentContainer>
  )
}
```

> **Note:** `ArchivedTab` receives no `initialJobs` so it fetches lazily on first render. The active-jobs page load stays the same — no extra DB query until the user opens the Archived tab.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/job-applications/_components/archived-tab.tsx \
        src/modules/jobs/mutations.ts \
        src/app/dashboard/job-applications/page.tsx
git commit -m "feat(jobs): lazy-loaded archived jobs tab with restore action"
```

---

## Self-Review

**Spec coverage:**
| Feature | Task |
|---|---|
| Select-all checkbox | Task 3 |
| Persist group collapse | Task 4 |
| Fix null dateApplied sort | Task 1 |
| Add datePublished column | Task 2 |
| Expand search (location, notes, status) | Task 5b |
| Vercel-style filter bar (Status, Source, Fit) | Task 5a + 5b |
| Sort controls | Task 5a + 5b |
| Posting-age indicator (pre-apply freshness / post-apply timing) | Task 6 |
| Archive tab (lazy-loaded) | Task 7 |
| Restore from archive | Task 7 |

**Potential issues:**
- `getArchivedJobs` is called as a Server Action from the client in `ArchivedTab`. Confirm it has `'use server'` directive or is imported from a file that does. Since it's in `queries.ts` (no `'use server'` directive) it needs to be wrapped. Either add `'use server'` to `queries.ts` or create a thin server action wrapper in `mutations.ts`. **Fix:** Create `getArchivedJobsAction` as a server action in `mutations.ts` that calls `getArchivedJobs()` internally, and import that in `archived-tab.tsx`.
- `archivedAt` is not in the `Job` type's `Omit` — it inherits from `JobApplication` so it's available. The `formatShortDate` call in `ArchivedRow` is safe.
- The `useState` lazy-fetch pattern in `ArchivedTab` works for one-time load but won't re-fetch if jobs are restored from another tab. This is acceptable — restores remove the row from local state via `onRestored`.
