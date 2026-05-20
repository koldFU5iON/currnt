'use client'

import { type Job } from "@/app/types/job-application"
import { AppProgressBar } from "./app-progress-bar"
import { StatusDropdown } from "./status-dropdown"
import { AppControls } from "@/components/app-item-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Label } from "@/components/ui/label"
import { Calendar, Flame, Pencil, SquareArrowOutUpRight } from "lucide-react"
import { ApplicationDateBlock } from "./app-date-block"

export function JobRow(props: Job) {
  const { id, jobNumber, title, company, countries, url, dateApplied, lastUpdated, status, progress } = props
  return (
    <div className="grid grid-cols-[1.5fr_40px_1fr_1fr_1fr_120px_40px] items-center justify-between space-x-2 hover:bg-amber-400/50 transition-colors ease-in-out w-full rounded-md p-2">
      <ApplicationHeader
        title={title}
        jobNumber={jobNumber}
        url={url}
        company={company}
        countries={countries}
      />
      <div>
        {/* TODO: render real job fit indicator once jobFit is populated */}
        <Flame className="fill-amber-500 " />
      </div>
      <AppProgressBar progress={progress} jobId={id} />
      <ApplicationDateBlock label="Applied" date={dateApplied} jobId={id} />
      <ApplicationDateBlock label="Last Update" date={lastUpdated} />
      <StatusDropdown jobId={id} status={status} />
      <div className="flex">
        <AppControls id={id} />
      </div>
    </div>
  )
}

type ApplicationHeaderProps = {
  title: string
  jobNumber: string | null
  url: string | null
  company: string
  countries: string[]
}

function ApplicationHeader({ title, jobNumber, company, countries, url }: ApplicationHeaderProps) {
  return (
    <div>
      <div className="flex items-center gap-1">
        <HoverCard>
          <HoverCardTrigger className="cursor-pointer">
            <Label className="text-md font-bold">{title}</Label>
          </HoverCardTrigger>
          <HoverCardContent className="w-fit text-xs">
            {jobNumber ?? "no job number found?"}
          </HoverCardContent>
        </HoverCard>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer">
            <SquareArrowOutUpRight size={14} />
          </a>
        )}
      </div>
      <div className="flex space-x-1.5 text-xs">
        <p className="text-xs">{company}</p>
        <div className="flex">{countries.join(" | ")}</div>
      </div>
      {/* TODO: render CV / Cover Letter document badges once document tracking is wired up */}
    </div>
  )
}


