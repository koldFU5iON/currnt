import { Badge } from "@/components/ui/badge"
import { type Job } from "@/app/types/job-application"
import { formatDate } from "@/lib/utils"
import { JobFit } from "@/app/dashboard/job-applications/_components/job-fit"

interface Props {
  job: Job
  hasLLMKey: boolean
}

export function JobStatsGrid({ job, hasLLMKey }: Props) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-5 [&>*:last-child]:col-span-2 md:[&>*:last-child]:col-span-1">
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
      <MetaCell label="Fit">
        <JobFit
          jobId={job.id}
          jobFit={job.jobFit ?? null}
          canAssess={!!job.jobDescription?.trim()}
          hasLLMKey={hasLLMKey}
        />
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
