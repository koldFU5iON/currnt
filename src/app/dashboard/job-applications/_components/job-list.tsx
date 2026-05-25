'use client'

import Link from "next/link"
import { useMemo, useState } from "react"
import { Plus, SearchIcon } from "lucide-react"
import { type Job } from "@/app/types/job-application"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { JobRow } from "./job-row"

export function JobList({ jobs }: { jobs: Job[] }) {
  const [query, setQuery] = useState("")

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((job) =>
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q)
    )
  }, [jobs, query])

  return (
    <div className="container w-full border-t border-accent pt-3 mt-2">
      <ToolBar
        query={query}
        onQueryChange={setQuery}
        visibleCount={filteredJobs.length}
        totalCount={jobs.length}
      />
      <Separator className="my-3" />
      {filteredJobs.length > 0 ? (
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto_auto] divide-y divide-border/50">
          {filteredJobs.map((job) => <JobRow key={job.id} {...job} />)}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-6 text-center">
          {query ? "No jobs match your search." : "No jobs yet. Create your first application."}
        </div>
      )}
    </div>
  )
}

type ToolBarProps = {
  query: string
  onQueryChange: (value: string) => void
  visibleCount: number
  totalCount: number
}

function ToolBar({ query, onQueryChange, visibleCount, totalCount }: ToolBarProps) {
  return (
    <div className="flex flex-col space-y-1">
      <div className="flex space-x-2 items-center">
        <JobSearchBar value={query} onChange={onQueryChange} />
        <Separator orientation="vertical" className="h-8" />
        <Link
          href="/dashboard/job-applications/create"
          className={cn(buttonVariants(), "gap-1.5")}
        >
          <Plus size={16} />
          Add Job
        </Link>
      </div>
      <div className="text-xs text-muted-foreground">
        {visibleCount === totalCount
          ? `${totalCount} Jobs Listed`
          : `${visibleCount} of ${totalCount} Jobs`}
      </div>
    </div>
  )
}

type JobSearchBarProps = {
  value: string
  onChange: (value: string) => void
}

function JobSearchBar({ value, onChange }: JobSearchBarProps) {
  return (
    <div className="flex ">
      <InputGroup className="w-sm">
        <InputGroupInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search for job..."
          aria-label="Search jobs"
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
