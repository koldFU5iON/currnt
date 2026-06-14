import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/session'
import { getCoverLetter } from '@/modules/cover-letters/queries'
import { getJobAssets } from '@/modules/jobs/queries'
import { JobContextNav } from '@/components/job-context-nav'
import { CoverLetterWorkspace } from './_components/cover-letter-workspace'

type Props = { params: Promise<{ id: string }> }

export default async function CoverLetterPage({ params }: Props) {
  const [{ id }, { profile }] = await Promise.all([params, requireProfile()])
  const letter = await getCoverLetter(profile.id, id)
  if (!letter) notFound()

  const jobAssets = letter.jobApplicationId
    ? await getJobAssets(letter.jobApplicationId, profile.id)
    : null

  return (
    <div className="flex h-full flex-col">
      {jobAssets && (
        <JobContextNav
          jobId={jobAssets.jobId}
          company={jobAssets.company}
          title={jobAssets.title}
          cvDocumentId={jobAssets.cvDocumentId}
          coverLetterDocumentId={jobAssets.coverLetterDocumentId}
          interviewPrepSessionId={jobAssets.interviewPrepSessionId}
          current="cover-letter"
        />
      )}
      <CoverLetterWorkspace letter={letter} />
    </div>
  )
}
