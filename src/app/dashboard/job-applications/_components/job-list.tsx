'use client'

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Archive, ListPlus, Plus, SearchIcon, X } from "lucide-react"
import {
  APPLICATION_STATUS_LABEL,
  ApplicationStatus,
  ClosedStatuses,
  type ApplicationStatusType,
  type Job,
  type JobFit,
} from "@/app/types/job-application"
import {
  FilterBar,
  DEFAULT_FILTER,
  DEFAULT_SORT,
  isFilterActive,
  type FilterState,
  type SortState,
} from './filter-bar'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { JobGroup } from "./job-group"
import { EditJobDialog } from "./edit-job-dialog"
import { CreateJobSheet } from "./create-job-sheet"
import { BatchCaptureDialog } from "./batch-capture-dialog"
import { archiveJobApplication, bulkArchiveJobApplications } from "@/modules/jobs/mutations"

type ViewMode = 'grouped' | 'all'
const VIEW_MODE_KEY = 'jobs-view-mode'
const FILTER_KEY = 'jobs-filter'
const SORT_KEY = 'jobs-sort'

// Priority order for open work — interviews top (most time-pressing), then
// active prep work, then sent-and-waiting, then untouched leads.
const OPEN_PRIORITY: ApplicationStatusType[] = [
  ApplicationStatus.Interviewing,
  ApplicationStatus.InProgress,
  ApplicationStatus.Applied,
  ApplicationStatus.NotStarted,
]

const CLOSED_SET: ReadonlySet<string> = new Set(ClosedStatuses)

export function JobList({ jobs, hasLLMKey, openCreate, initialCreateUrl }: {
  jobs: Job[]
  hasLLMKey: boolean
  openCreate?: boolean
  initialCreateUrl?: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>('grouped')
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Job | null>(null)
  const [creating, setCreating] = useState(openCreate ?? false)
  const [batching, setBatching] = useState(false)
  // Per-row in-flight label so the user sees "Archiving…" the instant they click,
  // not after the server roundtrip + revalidate finishes.
  const [busyRows, setBusyRows] = useState<Map<string, string>>(new Map())

  // ⌘J / Ctrl+J opens the create sheet from anywhere on the page.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCreating(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Hydrate view-mode preference once on mount. Doing this in an effect (rather
  // than as a lazy initial state) avoids an SSR/CSR hydration mismatch — server
  // renders with the default, client re-applies the saved preference.
  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_MODE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === 'all' || saved === 'grouped') setViewMode(saved)

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
    } catch { /* ignore malformed filter cache */ }

    try {
      const savedSort = window.localStorage.getItem(SORT_KEY)
      if (savedSort) {
        const p = JSON.parse(savedSort)
        if (p.field && p.direction) setSort(p)
      }
    } catch { /* ignore malformed sort cache */ }
  }, [])

  function changeViewMode(next: ViewMode) {
    setViewMode(next)
    window.localStorage.setItem(VIEW_MODE_KEY, next)
  }

  function changeFilter(next: FilterState) {
    setSelected(new Set())
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

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase()

    let result = q
      ? jobs.filter(j =>
          j.title.toLowerCase().includes(q) ||
          (j.company ?? '').toLowerCase().includes(q) ||
          j.countries.join(' ').toLowerCase().includes(q) ||
          (j.notes ?? '').toLowerCase().includes(q) ||
          APPLICATION_STATUS_LABEL[j.status].toLowerCase().includes(q)
        )
      : [...jobs]

    if (filter.status.size > 0) {
      result = result.filter(j => filter.status.has(j.status))
    }
    if (filter.source.size > 0) {
      result = result.filter(j => filter.source.has(j.applicationSource))
    }
    if (filter.fit.size > 0) {
      result = result.filter(j => {
        const label = j.jobFit?.label ?? 'none'
        return filter.fit.has(label as JobFit['label'] | 'none')
      })
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sort.field) {
        case 'dateApplied': {
          const aVal = a.dateApplied?.getTime()
          const bVal = b.dateApplied?.getTime()
          if (aVal == null && bVal == null) { cmp = 0; break }
          if (aVal == null) { return 1 }   // nulls always last
          if (bVal == null) { return -1 }
          cmp = aVal - bVal
          break
        }
        case 'datePublished': {
          const aVal = a.datePublished?.getTime()
          const bVal = b.datePublished?.getTime()
          if (aVal == null && bVal == null) { cmp = 0; break }
          if (aVal == null) { return 1 }
          if (bVal == null) { return -1 }
          cmp = aVal - bVal
          break
        }
        case 'company':
          cmp = (a.company ?? '').localeCompare(b.company ?? '')
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

  // Search auto-switches to "All" so matches aren't visually split across groups.
  // User's view-mode preference is preserved — restored when the query clears.
  const effectiveMode: ViewMode = query.trim() ? 'all' : viewMode

  const groups = useMemo(() => {
    if (effectiveMode === 'all') {
      return [{ key: 'all', label: null as string | null, jobs: filteredJobs, defaultCollapsed: false }]
    }
    const openGroups = OPEN_PRIORITY.map(s => ({
      key: s,
      label: APPLICATION_STATUS_LABEL[s] as string | null,
      jobs: filteredJobs.filter(j => j.status === s),
      defaultCollapsed: false,
    }))
    const closedJobs = filteredJobs.filter(j => CLOSED_SET.has(j.status))
    return [
      ...openGroups,
      { key: 'closed', label: 'Closed' as string | null, jobs: closedJobs, defaultCollapsed: true },
    ]
  }, [filteredJobs, effectiveMode])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  const isAllSelected = filteredJobs.length > 0 && filteredJobs.every(j => selected.has(j.id))
  const isSomeSelected = !isAllSelected && filteredJobs.some(j => selected.has(j.id))

  function toggleSelectAll() {
    const allIds = filteredJobs.map(j => j.id)
    const allSelected = allIds.every(id => selected.has(id))
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  function markBusy(ids: string[], label: string | null) {
    setBusyRows(prev => {
      const next = new Map(prev)
      for (const id of ids) {
        if (label) next.set(id, label)
        else next.delete(id)
      }
      return next
    })
  }

  function handleGenerateCV(id: string) {
    markBusy([id], 'Generating CV…')
    router.push(`/dashboard/cv-builder/new?jobId=${id}`)
  }

  function handleCreateCoverLetter(id: string) {
    router.push(`/dashboard/cover-letters/new?jobId=${id}`)
  }

  async function handleSingleArchive(id: string) {
    markBusy([id], 'Archiving…')
    try {
      await archiveJobApplication(id)
      toast.success('Job archived')
      setSelected(prev => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      // No clear needed on success — revalidate removes the row entirely.
    } catch {
      toast.error('Failed to archive')
      markBusy([id], null)
    }
  }

  async function handleBulkArchive() {
    const ids = [...selected]
    if (ids.length === 0) return
    markBusy(ids, 'Archiving…')
    try {
      const { archived } = await bulkArchiveJobApplications(ids)
      toast.success(`${archived} ${archived === 1 ? 'job' : 'jobs'} archived`)
      clearSelection()
    } catch {
      toast.error('Failed to archive')
      markBusy(ids, null)
    }
  }

  return (
    <div className="container w-full border-t border-accent pt-3 mt-2">
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
        onCreateOpen={() => setCreating(true)}
        onBatchOpen={() => setBatching(true)}
      />
      <Separator className="my-3" />

      {filteredJobs.length > 0 ? (
        <>
          {/* Mobile card list — below md only */}
          <div className="md:hidden border border-border/30 rounded-md overflow-hidden">
            {groups.map(g => (
              <JobGroup
                key={g.key}
                groupKey={g.key}
                label={g.label}
                jobs={g.jobs}
                defaultCollapsed={g.defaultCollapsed}
                selected={selected}
                busyRows={busyRows}
                onToggleSelect={toggleSelect}
                onEdit={setEditing}
                onArchive={handleSingleArchive}
                onGenerateCV={handleGenerateCV}
                onCreateCoverLetter={handleCreateCoverLetter}
                hasLLMKey={hasLLMKey}
                isMobile
              />
            ))}
          </div>

          {/* Desktop grid — md and above */}
          <div className="hidden md:grid grid-cols-[auto_1.5fr_auto_1fr_auto_auto_auto_auto_auto_auto_auto]">
            <ColHeaders
              isAllSelected={isAllSelected}
              isSomeSelected={isSomeSelected}
              onToggleAll={toggleSelectAll}
            />
            {groups.map(g => (
              <JobGroup
                key={g.key}
                groupKey={g.key}
                label={g.label}
                jobs={g.jobs}
                defaultCollapsed={g.defaultCollapsed}
                selected={selected}
                busyRows={busyRows}
                onToggleSelect={toggleSelect}
                onEdit={setEditing}
                onArchive={handleSingleArchive}
                onGenerateCV={handleGenerateCV}
                onCreateCoverLetter={handleCreateCoverLetter}
                hasLLMKey={hasLLMKey}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground py-6 text-center">
          {(query || isFilterActive(filter))
            ? "No jobs match your filters."
            : "No jobs yet. Create your first application."}
        </div>
      )}

      {editing && (
        <EditJobDialog
          job={editing}
          open={!!editing}
          onOpenChange={(o) => { if (!o) setEditing(null) }}
        />
      )}

      <CreateJobSheet
        open={creating}
        onOpenChange={setCreating}
        initialUrl={initialCreateUrl}
      />

      <BatchCaptureDialog open={batching} onOpenChange={setBatching} />
    </div>
  )
}

type ToolBarProps = {
  query: string
  onQueryChange: (value: string) => void
  visibleCount: number
  totalCount: number
  viewMode: ViewMode
  onViewModeChange: (m: ViewMode) => void
  selectedCount: number
  onClearSelection: () => void
  onBulkArchive: () => void
  filter: FilterState
  sort: SortState
  onFilterChange: (f: FilterState) => void
  onSortChange: (s: SortState) => void
  onCreateOpen: () => void
  onBatchOpen: () => void
}

function ToolBar({
  query,
  onQueryChange,
  visibleCount,
  totalCount,
  viewMode,
  onViewModeChange,
  selectedCount,
  onClearSelection,
  onBulkArchive,
  filter,
  sort,
  onFilterChange,
  onSortChange,
  onCreateOpen,
  onBatchOpen,
}: ToolBarProps) {
  return (
    <div className="flex flex-col space-y-1">
      <div className="flex flex-wrap gap-2 items-center">
        <JobSearchBar value={query} onChange={onQueryChange} />
        <Separator orientation="vertical" className="h-8" />
        <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
        <Separator orientation="vertical" className="h-8" />
        <FilterBar
          filter={filter}
          sort={sort}
          onFilterChange={onFilterChange}
          onSortChange={onSortChange}
        />

        {selectedCount > 0 && (
          <>
            <Separator orientation="vertical" className="h-8" />
            <Button variant="default" size="sm" onClick={onBulkArchive} className="gap-1.5">
              <Archive size={14} />
              Archive ({selectedCount})
            </Button>
            <Button variant="ghost" size="sm" onClick={onClearSelection} className="gap-1.5">
              <X size={14} />
              Clear
            </Button>
          </>
        )}

        <div className="flex-1" />

        <Button variant="outline" size="sm" className="gap-1.5" onClick={onBatchOpen}>
          <ListPlus size={16} />
          Batch Add
        </Button>

        <Button size="sm" className="gap-1.5" onClick={onCreateOpen}>
          <Plus size={16} />
          Add Job
          <kbd className="ml-0.5 hidden items-center gap-0.5 rounded border bg-background/20 px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
            <span className="text-xs">⌘</span>J
          </kbd>
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">
        {selectedCount > 0
          ? `${selectedCount} selected`
          : visibleCount === totalCount
            ? `${totalCount} Jobs Listed`
            : `${visibleCount} of ${totalCount} Jobs`}
      </div>
    </div>
  )
}

function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-background text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => onChange('grouped')}
        className={cn(
          'px-2.5 py-1.5 transition-colors',
          value === 'grouped'
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-pressed={value === 'grouped'}
      >
        By status
      </button>
      <button
        type="button"
        onClick={() => onChange('all')}
        className={cn(
          'px-2.5 py-1.5 border-l border-border transition-colors',
          value === 'all'
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-pressed={value === 'all'}
      >
        All
      </button>
    </div>
  )
}

type JobSearchBarProps = {
  value: string
  onChange: (value: string) => void
}

function JobSearchBar({ value, onChange }: JobSearchBarProps) {
  return (
    <div className="flex ">
      <InputGroup className="w-sm">
        <InputGroupInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search for job..."
          aria-label="Search jobs"
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

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
          checked={isAllSelected}
          indeterminate={isSomeSelected}
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
