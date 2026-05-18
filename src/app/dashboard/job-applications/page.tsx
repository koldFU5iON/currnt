"use client"

import { useState } from "react";
import { GridItem } from "@/app/components/application-item";
import { ApplicationProgress, ApplicationStatus, GridItemProps } from "@/app/types/job-application";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { SearchIcon } from "lucide-react";

const jobs: GridItemProps[] = [
  {
    id: "1",
    title: "Global Program Manager",
    company: "Stripe",
    url: "https://linkedin.com",
    countries: ["Ireland", "US"],
    applied: new Date("2026-04-05"),
    status: ApplicationStatus.NotStarted,
    progress: ApplicationProgress.Pending,
    lastUpdated: new Date("2026-04-05"),
  },
  {
    id: "2",
    title: "Senior Product Manager",
    company: "Linear",
    url: "https://linear.app",
    countries: ["Remote"],
    applied: new Date("2026-04-20"),
    status: ApplicationStatus.Applied,
    progress: ApplicationProgress.Recruiter,
    lastUpdated: new Date("2026-04-28"),
  },
  {
    id: "3",
    title: "Engineering Manager",
    company: "Vercel",
    countries: ["Remote"],
    applied: new Date("2026-05-01"),
    status: ApplicationStatus.Interviewing,
    progress: ApplicationProgress.Interview,
    lastUpdated: new Date("2026-05-10"),
  },
]

export default function Page() {
  const [foundJobs, setFoundJobs] = useState<GridItemProps[]>(jobs)

  const findJobs = (value: string) => {
    const filteredJobs = !value
      ? jobs
      : jobs.filter(job => job.title.toLowerCase().includes(value.toLowerCase()));
    setFoundJobs(filteredJobs)
  }
  return (
    <div className="flex-col m-2 p-4 rounded-2xl border md:w-6xl">
      <h1>Job applications</h1>
      <div className="container even:bg-accent w-full border-t border-accent pt-3 mt-2">
        {/* TODO: Add Search Bar */}
        <JobSearchBar onFindJobs={findJobs} />
        {/* row item */}
        {foundJobs ?
          foundJobs.map(job => {
            return <GridItem {...job} key={job.id} />
          }) : <div>"No Jobs Found"</div>}
      </div>
    </div>
  )
}

function JobSearchBar({ onFindJobs }: { onFindJobs: (value: string) => void }) {
  return (
    <div className="flex justify-center mb-2 ">
      <InputGroup className="w-lg">
        <InputGroupInput onChange={(e) => onFindJobs(e.target.value)} placeholder="Search for job..." />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )

}
