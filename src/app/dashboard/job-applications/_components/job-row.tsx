'use client'

import Link from "next/link"
import {
  ApplicationSource,
  APPLICATION_SOURCE_LABEL,
  type Job,
} from "@/app/types/job-application"
import { AppProgressBar } from "./app-progress-bar"
import { StatusDropdown } from "./status-dropdown"
import { AppControls } from "@/components/app-item-menu"
import { Loader2, SquareArrowOutUpRight } from "lucide-react"
import { ApplicationDateBlock } from "./app-date-block"
import { JobFit } from "./job-fit"
import { JobNotes } from "./job-notes"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"

type JobRowProps = {
  job: Job
  selected: boolean
  busyLabel?: string
  onToggleSelect: (id: string) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  hasLLMKey: boolean
}

export function JobRow({ job, selected, busyLabel, onToggleSelect, onEdit, onArchive, hasLLMKey }: JobRowProps) {
  const { id, jobNumber, title, company, countries, url, dateApplied, lastUpdated, status, progress, jobFit, notes, applicationSource, jobDescription } = job
  // Cold is the silent default — only surface a badge for sources worth noticing.
  const showSourceBadge = applicationSource !== ApplicationSource.Cold
  const busy = Boolean(busyLabel)

  return (
    <div className="group relative col-span-full grid grid-cols-subgrid items-center border-b border-border/30 last:border-b-0 transition-colors duration-150 hover:bg-muted/50 data-[selected=true]:bg-muted/40 data-[busy=true]:hover:bg-transparent"
         data-selected={selected}
         data-busy={busy}
         aria-busy={busy || undefined}>
      {busy && (
        <div className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-background/85 backdrop-blur-[1px]">
          <span role="status" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {busyLabel}
          </span>
        </div>
      )}
      <div className="flex items-center justify-center px-2 py-3">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(id)}
          aria-label={`Select ${title}`}
        />
      </div>

      <div className="min-w-0 px-3 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`/dashboard/job-applications/view/${id}`}
            className="truncate text-sm font-semibold leading-snug hover:underline"
          >
            {title}
          </Link>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${title} job listing on external site`}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <SquareArrowOutUpRight size={12} />
            </a>
          )}
          {showSourceBadge && (
            <Badge variant="outline" className="shrink-0 text-[10px] font-normal py-0 px-1.5 h-4">
              {APPLICATION_SOURCE_LABEL[applicationSource]}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {company}
          {countries.length > 0 && ` · ${countries.join(", ")}`}
          {jobNumber && <span className="font-mono"> · {jobNumber}</span>}
        </p>
      </div>

      <div className="py-3">
        <AppProgressBar progress={progress} jobId={id} />
      </div>

      <div className="py-3">
        <ApplicationDateBlock label="Applied" date={dateApplied} jobId={id} />
      </div>

      <div className="py-3">
        <ApplicationDateBlock label="Last Update" date={lastUpdated} />
      </div>

      <div className="py-3">
        <StatusDropdown jobId={id} status={status} />
      </div>

      <div className="flex items-center gap-1 px-3 py-3">
        <JobFit jobId={id} jobFit={jobFit || null} canAssess={!!jobDescription?.trim()} hasLLMKey={hasLLMKey} />
        <JobNotes jobId={id} initialNotes={notes ?? null} />
        <AppControls
          id={id}
          onEdit={() => onEdit(job)}
          onArchive={() => onArchive(id)}
        />
      </div>
    </div>
  )
}
