import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/session'
import { getExperienceWithSuggestionContext } from '@/modules/profile/queries'
import { ContentContainer } from '@/app/components/ContentContainer'
import { ChevronLeft } from 'lucide-react'
import { NotesEditor } from './_components/NotesEditor'

export default async function ExperienceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { profile } = await requireProfile()

  const ctx = await getExperienceWithSuggestionContext(id, profile.id)
  if (!ctx) notFound()

  const { experience, skills } = ctx

  const startLabel = experience.startDate.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  })
  const endLabel = experience.endDate
    ? experience.endDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : 'Present'

  return (
    <ContentContainer
      title={`${experience.role} · ${experience.company}`}
      fullWidth
    >
      <div className="mb-4">
        <Link
          href="/dashboard/profile"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          Back to Profile
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold">{experience.role}</h1>
        <p className="text-muted-foreground">{experience.company}</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {startLabel} – {endLabel}
        </p>
      </div>

      <NotesEditor
        experienceId={experience.id}
        initialNotes={experience.summary ?? ''}
        existingActivities={experience.activities}
        existingSkills={skills}
      />
    </ContentContainer>
  )
}
