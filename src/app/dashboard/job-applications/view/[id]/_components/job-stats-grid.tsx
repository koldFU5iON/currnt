import { Badge } from "@/components/ui/badge"
import { type Job } from "@/app/types/job-application"
import { formatDate } from "@/lib/utils"

export function JobStatsGrid({ job }: { job: Job }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
      <MetaCell label="Status">
        <Badge variant="secondary" className="w-fit capitalize">{job.status}</Badge>
      </MetaCell>
      <MetaCell label="Progress">
        <span className="text-sm font-medium capitalize">{job.progress}</span>
      </MetaCell>
      <MetaCell label="Applied">
        <span className="text-sm font-medium">{formatDate(job.dateApplied) ?? "Not recorded"}</span>
      </MetaCell>
      <MetaCell label="Last updated">
        <span className="text-sm font-medium">{formatDate(job.lastUpdated) ?? "—"}</span>
      </MetaCell>
    </div>
  )
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
