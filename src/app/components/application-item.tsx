'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { Archive, Calendar, Check, FilePlus, LucideIcon, Pencil, SquareArrowOutUpRight, Trash } from "lucide-react";
import { useState } from "react";
import { type ApplicationStatusType, ApplicationStatus, GridItemProps } from "../types/job-application";
import { AppProgressBar } from "./AppProgressBar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export function GridItem({ id, title, company, countries, url, applied, lastUpdated, status, progress }: GridItemProps) {
  return (
    <div className="flex items-center justify-between space-x-2 hover:bg-amber-400/50 transition-colors ease-in-out w-full rounded-md p-2">
      <ApplicationHeader
        title={title}
        company={company}
        countries={countries}
        url={url}
      />
      <AppProgressBar progress={progress} />
      <ApplicationDateBlock label="Applied" date={applied} />
      <ApplicationDateBlock label="Last Update" date={lastUpdated} />
      <div>
        <StatusDropdown status={status} />
      </div>
      <div className="flex">
        <AppControls />
      </div>
    </div>
  )
}

type ApplicationHeaderProps = {
  title: string
  url?: string
  company: string
  countries: string[]
}
function ApplicationHeader({ title, company, countries, url }: ApplicationHeaderProps) {
  return (
    <div>
      <div className="flex items-center gap-1">
        <h1 className="font-bold">{title}</h1>
        {url && <a href={url} target="_blank">
          <SquareArrowOutUpRight size={14} />
        </a>}
      </div>
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

function AppControls() {
  return (
    <div className="flex items-center space-x-2 p-2 justify-between border rounded-md">
      <AppControlsItem Icon={FilePlus} />
      <AppControlsItem Icon={Pencil} />
      <AppControlsItem Icon={Archive} />
      <AppControlsItem Icon={Trash} color="red" />
    </div>
  )
}

type AppControlsItemProps = {
  Icon: LucideIcon
  color?: string
}

function AppControlsItem({ Icon, color }: AppControlsItemProps) {
  return (
    <Button variant="outline">
      {Icon && <Icon color={color} className="size-4" />}
    </Button>
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
