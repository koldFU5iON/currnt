'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Archive, LucideIcon, Pencil, Trash } from "lucide-react";
import { useState } from "react";
import { type ApplicationStatusType, ApplicationStatus, GridItemProps } from "../types/job-application";
import { AppProgressBar } from "./AppProgressBar";

export function GridItem({ id, title, company, countries, url, applied, status }: GridItemProps) {
  return (
    <div key={id} className="flex items-center justify-between space-x-2 w-full rounded-md p-2">
      <ApplicationHeader
        title={title}
        company={company}
        countries={countries}
        url={url}
      />
      <AppProgressBar progress="recruiter screening" />
      <div className="flex-col">
        <ApplicationDate date={applied} />
      </div>
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
      <h1 className="font-bold">{title}</h1>
      <div className="flex space-x-1.5 text-xs">
        <p className="text-xs">{company}</p>
        <div className="flex">{countries.join(" | ")}</div>
      </div>
    </div>

  )
}

type ApplicationDateProps = {
  date: Date
}

function ApplicationDate({ date }: ApplicationDateProps) {
  return (
    <div className="flex flex-col">
      <div className="text-xs font-semibold">
        Applied:
      </div>
      <div className="font-bold">
        04 May, 2026
      </div>
      <div className="text-xs italic">
        24 days ago.
      </div>
    </div>
  )
}

function AppControls() {
  return (
    <div className="flex items-center space-x-2 p-2 between border rounded-md">
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
  console.log("value", value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        {value}
      </DropdownMenuTrigger>
      <DropdownMenuContent >
        <DropdownMenuGroup>
          {Object.values(ApplicationStatus).map(state => <DropdownMenuItem key={state} onClick={() => setValue(state)} className="capitalize">{state}</DropdownMenuItem>)}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu >)
}
