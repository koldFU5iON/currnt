import Link from "next/link"
import { type Job } from "@/app/types/job-application"

export function JobDetailHeader({ job }: { job: Job }) {
  return (
    <div className="space-y-2">
      <Link
        href="/dashboard/job-applications"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to applications
      </Link>
      <h1 className="text-4xl font-bold">{job.title}</h1>
      <p className="text-xl text-muted-foreground">{job.company}</p>
    </div>
  )
}
