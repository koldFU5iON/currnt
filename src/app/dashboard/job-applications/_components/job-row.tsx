'use client'

import Link from "next/link"
import { type Job } from "@/app/types/job-application"
import { AppProgressBar } from "./app-progress-bar"
import { StatusDropdown } from "./status-dropdown"
import { AppControls } from "@/components/app-item-menu"
import { SquareArrowOutUpRight } from "lucide-react"
import { ApplicationDateBlock } from "./app-date-block"
import { JobFit } from "./job-fit"

export function JobRow(props: Job) {
  const { id, jobNumber, title, company, countries, url, dateApplied, lastUpdated, status, progress, jobFit } = props

  return (
    <div className="group col-span-full grid grid-cols-subgrid items-center transition-colors duration-150 hover:bg-muted/50">
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
        <JobFit jobFit={jobFit || null} />
        <AppControls id={id} />
      </div>
    </div>
  )
}
