import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { JobList } from "./_components/job-list"
import { ArchivedTab } from "./_components/archived-tab"
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
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <JobList jobs={jobs} hasLLMKey={hasLLMKey} />
        </TabsContent>
        <TabsContent value="archived">
          <ArchivedTab />
        </TabsContent>
      </Tabs>
    </ContentContainer>
  )
}
