import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/session'
import { getCoverLetter } from '@/modules/cover-letters/queries'
import { reviewLetter } from '@/modules/writing-guide/actions'
import { ReviewResults } from './_components/review-results'

type Props = { params: Promise<{ id: string }> }

export default async function ReviewPage({ params }: Props) {
  const [{ id }, { profile }] = await Promise.all([params, requireProfile()])
  const letter = await getCoverLetter(profile.id, id)
  if (!letter) notFound()

  if (!letter.content.trim()) {
    redirect(`/dashboard/cover-letters/${id}`)
  }

  const result = await reviewLetter(id)

  const title = letter.jobTitle ?? letter.jobApplication?.title
  const company = letter.company ?? letter.jobApplication?.company

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2 text-sm">
        <Link href={`/dashboard/cover-letters/${id}`} className="text-muted-foreground hover:text-foreground">
          ← Back to letter
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold">✦ Review</span>
        {(title || company) && (
          <span className="text-xs text-muted-foreground">
            {[title, company].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {result.ok ? (
          <ReviewResults review={result.review} />
        ) : (
          <div className="mx-auto max-w-lg px-4 py-10">
            <p className="text-sm text-destructive">{result.message}</p>
            <Link href={`/dashboard/cover-letters/${id}`} className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">
              ← Back to letter
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
