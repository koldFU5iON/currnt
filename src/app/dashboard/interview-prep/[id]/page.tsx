// src/app/dashboard/interview-prep/[id]/page.tsx
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/session'
import { getSession } from '@/modules/interview-prep/queries'
import { PrepWorkspace } from './_components/prep-workspace'

type Props = { params: Promise<{ id: string }> }

export default async function InterviewPrepWorkspacePage({ params }: Props) {
  const [{ id }, { profile }] = await Promise.all([params, requireProfile()])
  const session = await getSession(profile.id, id)
  if (!session) notFound()
  return <PrepWorkspace session={session} />
}
