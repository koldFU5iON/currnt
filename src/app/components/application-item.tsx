'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { type ApplicationStatusType, ApplicationStatus, GridItemProps } from "../types/job-application";
import { AppProgressBar } from "./AppProgressBar";
import { Badge } from "@/components/ui/badge";
import { AppControls } from "@/components/AppItemMenu";
import { Calendar, Check, Flame, SquareArrowOutUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";

export function GridItem(props: GridItemProps) {
  const { id, title, jobFit, jobNumber, company, countries, url, applied, lastUpdated, status, progress } = props
  return (
    <div className="grid grid-cols-[1.5fr_40px_1fr_1fr_1fr_120px_40px] items-center justify-between space-x-2 hover:bg-amber-400/50 transition-colors ease-in-out w-full rounded-md p-2">
      <ApplicationHeader
        {...props}
      />
      <div>
        {/* TODO: add here the job fit variables */}
        <Flame className="fill-amber-500 " />
      </div>
      <AppProgressBar progress={progress} />
      <ApplicationDateBlock label="Applied" date={applied} />
      <ApplicationDateBlock label="Last Update" date={lastUpdated} />
      <StatusDropdown status={status} />
      <div className="flex">
        <AppControls />
      </div>
    </div>
  )
}

type ApplicationHeaderProps = {
  title: string
  jobNumber?: string
  url?: string
  company: string
  countries: string[]
}
function ApplicationHeader({ title, jobNumber, company, countries, url }: ApplicationHeaderProps) {
  return (
    <div>
      <HoverCard>
        <HoverCardTrigger>
          <div className="flex items-center gap-1">
            <Label className="text-md font-bold">{title}</Label>
            {url && <a href={url} target="_blank">
              <SquareArrowOutUpRight size={14} />
            </a>}
          </div>
        </HoverCardTrigger>
        <HoverCardContent className="w-fit text-xs">
          {jobNumber ?? "no job number found?"}
        </HoverCardContent>
      </HoverCard>
      <div className="flex space-x-1.5 text-xs">
        <p className="text-xs">{company}</p>
        <div className="flex">{countries.join(" | ")}</div>
      </div>
      <div className="flex text-xs space-x-2 mt-1">
        <Badge className="flex items-center gap-0.5 justify-center" >
          <Check size={10} color="green" /> CV
        </Badge>
        <Badge className="flex items-center gap-0.5 justify-center">
          <Check size={10} color="green" /> Cover Letter
        </Badge>
      </div>
    </div >
  )
}

type ApplicationDateBlockProps = {
  date: Date,
  label: string,
}

function ApplicationDateBlock({ label, date }: ApplicationDateBlockProps) {
  const today = new Date()
  const daysAgo = Math.floor((Number(today) - Number(date)) / (1000 * 60 * 60 * 24))
  return (
    <div className="flex flex-col">
      <div className="text-xs font-semibold">
        {label}:
      </div>
      <div className="flex items-center gap-1 space-x-2 font-bold text-sm">
        <Calendar size={12} /> {date.toDateString()}
      </div>
      <div className="text-xs italic">
        {daysAgo} days ago
      </div>
    </div>
  )
}

function StatusDropdown({ status }: { status: ApplicationStatusType }) {
  const [value, setValue] = useState(status)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "outline" })}>
        {value}
      </DropdownMenuTrigger>
      <DropdownMenuContent >
        <DropdownMenuGroup>
          {Object.values(ApplicationStatus).map(state => <DropdownMenuItem key={state} onClick={() => setValue(state)} className="capitalize">{state}</DropdownMenuItem>)}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu >)
}
