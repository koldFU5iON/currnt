import { ContentContainer } from '@/app/components/ContentContainer'
import { requireProfile } from '@/lib/session'
import { prisma } from '@/lib/db'
import { CVGenerationForm } from './_components/cv-generation-form'

export default async function Page() {
  const { profile } = await requireProfile()

  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { mergeRepeatedEmployers: true },
  })

  return (
    <ContentContainer
      title="CV Generation"
      description="Control how the AI structures and formats your generated CVs."
    >
      <CVGenerationForm
        initialMergeRepeatedEmployers={settings?.mergeRepeatedEmployers ?? false}
      />
    </ContentContainer>
  )
}
