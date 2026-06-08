import { redirect } from 'next/navigation'
import { createCoverLetter } from '@/modules/cover-letters/actions'

export default async function NewCoverLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>
}) {
  const { jobId } = await searchParams
  const { id } = await createCoverLetter(jobId)
  redirect(`/dashboard/cover-letters/${id}`)
}
