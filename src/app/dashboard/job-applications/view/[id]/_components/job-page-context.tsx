'use client'

import { useWorkspaceContext } from '@/lib/context/page-context'

type Props = {
  jobId: string
  title: string
  company?: string | null
  status?: string | null
}

export function JobPageContext({ jobId, title, company, status }: Props) {
  useWorkspaceContext({
    type: 'job_application',
    jobId,
    title,
    company: company ?? undefined,
    status: status ?? undefined,
  })
  return null
}
