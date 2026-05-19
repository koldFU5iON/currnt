'use client'

import { type Job } from "@/app/types/job-application"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { Plus, SearchIcon } from "lucide-react"
import { useState } from "react"
import { JobRow } from "../application-item"

export function JobList({ jobs }: { jobs: Job[] }) {
  const [foundJobs, setFoundJobs] = useState<Job[]>(jobs)

  const findJobs = (value: string) => {
    const filteredJobs = !value
      ? jobs
      : jobs.filter(job => job.title.toLowerCase().includes(value.toLowerCase()));
    setFoundJobs(filteredJobs)
  }
  return (
    <div className="container even:bg-accent w-full border-t border-accent pt-3 mt-2">
      <ToolBar findJobs={findJobs} jobs={foundJobs} />
      <Separator className="my-3" />
      {/* row item */}
      {foundJobs ?
        foundJobs.map(job => {
          return <JobRow {...job} key={job.id} />
        }) : <div>"No Jobs Currently Available"</div>}
    </div>
  )
}

function JobSearchBar({ onFindJobs }: { onFindJobs: (value: string) => void }) {
  return (
    <div className="flex mb-2 ">
      <InputGroup className="w-sm">
        <InputGroupInput onChange={(e) => onFindJobs(e.target.value)} placeholder="Search for job..." />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )

}
type ToolBarProps = {
  findJobs: (value: string) => void
  jobs: Job[]
}

function ToolBar({ findJobs, jobs }: ToolBarProps) {
  return (
    <div className="flex flex-col spacy-y-1">
      <div className="flex space-x-2">
        <JobSearchBar onFindJobs={findJobs} />
        <Separator orientation="vertical" />
        <div>
          <Button type="button" className="flex flex-row" >
            <Plus /> Add Job
          </Button>
        </div>
      </div>
      <div className="text-xs">
        {jobs.length} Jobs Listed
      </div>
    </div>
  )
}
