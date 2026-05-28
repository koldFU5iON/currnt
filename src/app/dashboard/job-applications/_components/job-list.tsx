'use client'

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Archive, Plus, SearchIcon, X } from "lucide-react"
import {
  APPLICATION_STATUS_LABEL,
  ApplicationStatus,
  ClosedStatuses,
  type ApplicationStatusType,
  type Job,
} from "@/app/types/job-application"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { JobGroup } from "./job-group"
import { EditJobDialog } from "./edit-job-dialog"
import { archiveJobApplication, bulkArchiveJobApplications } from "@/modules/jobs/mutations"

type ViewMode = 'grouped' | 'all'
const VIEW_MODE_KEY = 'jobs-view-mode'

// Priority order for open work — interviews top (most time-pressing), then
// active prep work, then sent-and-waiting, then untouched leads.
const OPEN_PRIORITY: ApplicationStatusType[] = [
  ApplicationStatus.Interviewing,
  ApplicationStatus.InProgress,
  ApplicationStatus.Applied,
  ApplicationStatus.NotStarted,
]

const CLOSED_SET: ReadonlySet<string> = new Set(ClosedStatuses)

export function JobList({ jobs, hasLLMKey }: { jobs: Job[]; hasLLMKey: boolean }) {
  const [query, setQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>('grouped')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Job | null>(null)
  // Per-row in-flight label so the user sees "Archiving…" the instant they click,
  // not after the server roundtrip + revalidate finishes.
  const [busyRows, setBusyRows] = useState<Map<string, string>>(new Map())

  // Hydrate view-mode preference once on mount. Doing this in an effect (rather
  // than as a lazy initial state) avoids an SSR/CSR hydration mismatch — server
  // renders with the default, client re-applies the saved preference.
  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_MODE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === 'all' || saved === 'grouped') setViewMode(saved)
  }, [])

  function changeViewMode(next: ViewMode) {
    setViewMode(next)
    window.localStorage.setItem(VIEW_MODE_KEY, next)
  }

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter(j =>
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q),
    )
  }, [jobs, query])

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
      />
      <Separator className="my-3" />

      {filteredJobs.length > 0 ? (
        <div className="grid grid-cols-[auto_1.5fr_1fr_1fr_1fr_auto_auto]">
          {groups.map(g => (
            <JobGroup
              key={g.key}
              label={g.label}
              jobs={g.jobs}
              defaultCollapsed={g.defaultCollapsed}
              selected={selected}
              busyRows={busyRows}
              onToggleSelect={toggleSelect}
              onEdit={setEditing}
              onArchive={handleSingleArchive}
              hasLLMKey={hasLLMKey}
            />
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-6 text-center">
          {query ? "No jobs match your search." : "No jobs yet. Create your first application."}
        </div>
      )}

      {editing && (
        <EditJobDialog
          job={editing}
          open={!!editing}
          onOpenChange={(o) => { if (!o) setEditing(null) }}
        />
      )}
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
}: ToolBarProps) {
  return (
    <div className="flex flex-col space-y-1">
      <div className="flex space-x-2 items-center">
        <JobSearchBar value={query} onChange={onQueryChange} />
        <Separator orientation="vertical" className="h-8" />
        <ViewModeToggle value={viewMode} onChange={onViewModeChange} />

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

        <Link
          href="/dashboard/job-applications/create"
          className={cn(buttonVariants(), "gap-1.5")}
        >
          <Plus size={16} />
          Add Job
        </Link>
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
