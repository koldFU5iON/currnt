import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ContentContainer } from '@/app/components/ContentContainer'
import { requireProfile } from '@/lib/session'
import { prisma } from '@/lib/db'
import { AIWritingForm } from './_components/ai-writing-form'

export default async function Page() {
  const { profile } = await requireProfile()

  const [writingRules, settings] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/lib/prompts/writing-rules.md'), 'utf-8'),
    prisma.userSettings.findUnique({
      where: { profileId: profile.id },
      select: { writingBrief: true },
    }),
  ])

  return (
    <ContentContainer
      title="AI Writing"
      description="Personalise how AI writes about you and see the quality rules applied to all output."
    >
      <AIWritingForm
        initialBrief={settings?.writingBrief ?? null}
        writingRules={writingRules}
      />
    </ContentContainer>
  )
}
