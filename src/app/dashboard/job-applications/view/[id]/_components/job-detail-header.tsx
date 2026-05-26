import Link from "next/link"
import { type Job } from "@/app/types/job-application"
import { ArrowLeft, SquareArrowOutUpRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { JobFit } from "../../../_components/job-fit"

export function JobDetailHeader({ job }: { job: Job }) {
  return (
    <div className="space-y-3">
      <Link
        href="/dashboard/job-applications"
        className="inline-flex items-center gap-1.5 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft size={14} />
        Back to applications
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold leading-tight md:text-3xl">{job.title}</h1>
            <JobFit
              jobId={job.id}
              jobFit={job.jobFit ?? null}
              canAssess={!!job.jobDescription?.trim()}
            />
          </div>
          <p className="text-base text-muted-foreground">{job.company}</p>
        </div>

        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 gap-1.5")}
          >
            <SquareArrowOutUpRight size={14} />
            View listing
          </a>
        )}
      </div>
    </div>
  )
}
