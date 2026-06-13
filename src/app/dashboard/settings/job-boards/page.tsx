import { ContentContainer } from '@/app/components/ContentContainer'
import { getJobBoardKeyStatus } from './_actions'
import { JobBoardsForm } from './_components/job-boards-form'

export default async function JobBoardsSettingsPage() {
  const { adzunaConfigured, jSearchConfigured } = await getJobBoardKeyStatus()
  return (
    <ContentContainer
      title="Job Board Sources"
      description="Configure API keys for paid job board integrations."
    >
      <JobBoardsForm
        adzunaConfigured={adzunaConfigured}
        jSearchConfigured={jSearchConfigured}
      />
    </ContentContainer>
  )
}
