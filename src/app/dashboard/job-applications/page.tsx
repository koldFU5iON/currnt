import { JobList } from "./_components/job-list"
import { getActiveJobs } from "@/modules/jobs/queries"
import { ContentContainer } from "@/app/components/ContentContainer"
import { requireProfile } from "@/lib/session"
import { getLLMConfigStatus } from "@/modules/llm/client"

export default async function Page() {
  const [jobs, { profile }] = await Promise.all([
    getActiveJobs(),
    requireProfile(),
  ])
  const { configured: hasLLMKey } = await getLLMConfigStatus(profile.id)

  return (
    <ContentContainer fullWidth title="Job Applications" description="Track all the jobs you're currently interested in. Update the status to keep up to date on the current process and where you stand with your application">
      <JobList jobs={jobs} hasLLMKey={hasLLMKey} />
    </ContentContainer>
  )
}
