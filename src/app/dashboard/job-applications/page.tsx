import { GridItem } from "@/app/components/application-item";
import { ApplicationProgress, GridItemProps } from "@/app/types/job-application";
import { ApplicationStatus } from "@/app/types/job-application";
// dummy jobs 
const jobs: GridItemProps[] = [{
  id: "1",
  title: "Global Program Manager",
  company: "Stripe",
  url: "https://linkedin.com",
  countries: ["Ireland", "US"],
  applied: new Date("04-05-2026"),
  status: ApplicationStatus.NotStarted,
  progress: ApplicationProgress.Pending,
  lastUpdated: new Date()
}]

export default function Page() {
  return (
    <div className="flex-col m-2 p-4 rounded-2xl border md:w-6xl">
      <h1>Job applications</h1>
      <div className="container even:bg-accent w-full border-t border-accent pt-3 mt-2">
        {/* row item */}
        {jobs.map(job => {
          return <GridItem {...job} key={job.id} />
        })}
      </div>
    </div>
  )
}

