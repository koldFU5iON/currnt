import { JobList } from "./_components/job-list";
import { getActiveJobs } from "@/modules/jobs/queries";
import { ContentContainer } from "@/app/components/ContentContainer";

export default async function Page() {
  const jobs = await getActiveJobs()

  return (
    <ContentContainer title="Job Applications" description="Track all the jobs you're currently interested in. Update the status to keep up to date on the current process and where you stand with your application">
      <h1>Job applications</h1>
      <JobList jobs={jobs} />
    </ContentContainer>
  )
}

