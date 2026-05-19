import { JobList } from "./_components/job-list";
import { getActiveJobs } from "@/modules/jobs/queries";

export default async function Page() {
  const jobs = await getActiveJobs()

  return (
    <div className="flex-col m-2 p-4 rounded-2xl border md:w-6xl">
      <h1>Job applications</h1>
      <JobList jobs={jobs} />
    </div>
  )
}

