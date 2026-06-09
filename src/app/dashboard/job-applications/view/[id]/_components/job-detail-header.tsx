import Link from "next/link"
import { type Job, ApplicationStatus } from "@/app/types/job-application"
import { ArrowLeft, ClipboardList, SquareArrowOutUpRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
          <h1 className="text-2xl font-semibold leading-tight md:text-3xl">{job.title}</h1>
          <p className="text-base text-muted-foreground">{job.company}</p>
        </div>

        <div className="flex shrink-0 gap-2">
          {(job.status === ApplicationStatus.Applied || job.status === ApplicationStatus.Interviewing) && (
            <Link
              href={`/dashboard/interview-prep/new?jobId=${job.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <ClipboardList size={14} />
              Prep interview
            </Link>
          )}
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <SquareArrowOutUpRight size={14} />
              View listing
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
