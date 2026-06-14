import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/session'
import { getCoverLetter } from '@/modules/cover-letters/queries'
import { listActiveJobsForPicker, getJobAssets } from '@/modules/jobs/queries'
import { getLLMConfigStatus } from '@/modules/llm/client'
import { JobContextNav } from '@/components/job-context-nav'
import { GuideClient } from './_components/guide-client'

type Props = { params: Promise<{ id: string }> }

export default async function GuidePage({ params }: Props) {
  const [{ id }, { profile }] = await Promise.all([params, requireProfile()])
  const [letter, llmStatus, activeJobs] = await Promise.all([
    getCoverLetter(profile.id, id),
    getLLMConfigStatus(profile.id),
    listActiveJobsForPicker(profile.id),
  ])
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
      <div className="flex items-center gap-3 border-b px-4 py-2 text-sm">
        <Link
          href={`/dashboard/cover-letters/${id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Back to letter
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold">✦ Writing Guide</span>
        {(letter.jobTitle || letter.company) && (
          <span className="text-xs text-muted-foreground">
            {[letter.jobTitle, letter.company].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <GuideClient letter={letter} llmConfigured={llmStatus.configured} activeJobs={activeJobs} />
      </div>
    </div>
  )
}
