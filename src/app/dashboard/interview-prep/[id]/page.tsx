// src/app/dashboard/interview-prep/[id]/page.tsx
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/session'
import { getSession } from '@/modules/interview-prep/queries'
import { getJobAssets } from '@/modules/jobs/queries'
import { JobContextNav } from '@/components/job-context-nav'
import { PrepWorkspace } from './_components/prep-workspace'

type Props = { params: Promise<{ id: string }> }

export default async function InterviewPrepWorkspacePage({ params }: Props) {
  const [{ id }, { profile }] = await Promise.all([params, requireProfile()])
  const session = await getSession(profile.id, id)
  if (!session) notFound()

  const jobAssets = session.jobApplicationId
    ? await getJobAssets(session.jobApplicationId, profile.id)
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
          current="prep"
        />
      )}
      <PrepWorkspace session={session} />
    </div>
  )
}
