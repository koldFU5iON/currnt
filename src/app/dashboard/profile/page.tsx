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
    phone: profile.phone ?? undefined,
    email: profile.email ?? undefined,
    site: profile.website ?? undefined,
    profile: profile.linkedIn ?? undefined,
    location: profile.location ?? undefined,
  }

  return (
    <ContentContainer title="Professional Profile" fullWidth>
      <ProfileHeader name={profile.name} headline={profile.headline ?? undefined} />

      <div className="flex flex-col gap-8 items-start md:flex-row">
        {/* Left rail — sticky sidebar */}
        <aside className="w-full rounded-xl border bg-card p-4 md:w-56 lg:w-64 xl:w-72 2xl:w-80 md:shrink-0 md:sticky md:top-6 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto md:rounded-none md:border-0 md:bg-transparent md:p-0 space-y-6 pb-6">
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
