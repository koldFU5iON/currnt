'use client'

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { type Job } from "@/app/types/job-application"
import { JobRow } from "./job-row"
import { JobRowCard } from "./job-row-card"

type JobGroupProps = {
  label: string | null
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

// One section of the list. Same shape whether it's the sole "All" group
// (label=null, no header) or one of several status groups (Interviewing / etc.).
// Subgrid spans the parent's columns so every group's cells line up exactly.
export function JobGroup({
  label,
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

  if (jobs.length === 0) return null

  const isCollapsible = label !== null

  return (
    <div className={isMobile ? undefined : "col-span-full grid grid-cols-subgrid"}>
      {label !== null && (
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
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
