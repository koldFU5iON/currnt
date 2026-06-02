import { ContentContainer } from "@/app/components/ContentContainer"
import { ExperienceBlock } from "./_components/Experience"
import { getFullProfile } from "@/modules/profile/queries"
import { ContactBlock } from "./_components/Contact"
import { ProfileHeader } from "./_components/ProfileHeader"
import { LeftRail } from "./_components/LeftRail"
import { ProjectBlock } from "./_components/ProjectBlock"
import { ProfileSummaryCard } from "./_components/ProfileSummaryCard"
import { getLLMConfigStatus } from "@/modules/llm/client"
import { requireProfile } from "@/lib/session"

export default async function Page() {
  const { profile: sessionProfile } = await requireProfile()
  const [profile, { configured: hasLLMKey }] = await Promise.all([
    getFullProfile(),
    getLLMConfigStatus(sessionProfile.id),
  ])

  const currentYear = new Date().getFullYear()
  const earliestYear = profile.experiences.length > 0
    ? Math.min(...profile.experiences.map(e => new Date(e.startDate).getFullYear()))
    : currentYear - 10
  const careerYears = Math.max(currentYear - earliestYear, 1)

  const contact = {
    name: profile.name,
    phone: profile.phone ?? undefined,
    email: profile.email ?? undefined,
    site: profile.website ?? undefined,
    profile: profile.linkedIn ?? undefined,
    location: profile.location ?? undefined,
  }

  return (
    <ContentContainer title="Professional Profile" fullWidth>
      <ProfileHeader name={profile.name} headline={profile.headline ?? undefined} />

      <div className="flex gap-8 items-start">
        {/* Left rail — sticky sidebar */}
        <aside className="w-64 shrink-0 sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto space-y-6 pb-6">
          <ContactBlock contact={contact} />
          <LeftRail
            skills={profile.skills}
            tools={profile.tools}
            languages={profile.languages}
            competencies={profile.competencies}
            educations={profile.educations}
            certifications={profile.certifications}
            careerYears={careerYears}
          />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-8">
          <ProfileSummaryCard
            initialSummary={profile.summary}
            hasLLMKey={hasLLMKey}
          />
          <ExperienceBlock exp={profile.experiences} />
          <ProjectBlock initial={profile.projects} hasLLMKey={hasLLMKey} />
        </main>
      </div>
    </ContentContainer>
  )
}
