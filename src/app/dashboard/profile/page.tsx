import { ContentContainer } from "@/app/components/ContentContainer"
import { ExperienceBlock } from "./_components/Experience"
import { getFullProfile } from "@/modules/profile/queries"
import { ContactBlock } from "./_components/Contact"
import { QualificationsBlock } from "./_components/Qualifications"
import { ProfileSummaryCard } from "./_components/ProfileSummaryCard"
import { getLLMConfigStatus } from "@/modules/llm/client"
import { requireProfile } from "@/lib/session"
import type { FullProfile } from "@/app/types/profile"

export type QualificationsType = {
  skills: FullProfile['skills']
  education: FullProfile['educations']
  certifications: FullProfile['certifications']
  tools: FullProfile['languages']
}

export default async function Page() {
  const { profile: sessionProfile } = await requireProfile()
  const [profile, { configured: hasLLMKey }] = await Promise.all([
    getFullProfile(),
    getLLMConfigStatus(sessionProfile.id),
  ])

  const contact = {
    name: profile.name,
    phone: profile.phone ?? undefined,
    email: profile.email ?? undefined,
    site: profile.website ?? undefined,
    profile: profile.linkedIn ?? undefined,
    location: profile.location ?? undefined,
  }

  const currentYear = new Date().getFullYear()
  const earliestYear = profile.experiences.length > 0
    ? Math.min(...profile.experiences.map(e => e.startDate.getFullYear()))
    : currentYear - 10
  const careerYears = Math.max(currentYear - earliestYear, 1)

  const qualifications = {
    skills: profile.skills,
    education: profile.educations,
    certifications: profile.certifications,
    tools: profile.languages,
  }

  return (
    <ContentContainer title="Profile Page" fullWidth>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div>
          {contact.name && <ContactBlock contact={contact} />}
        </div>
        <div className="md:col-span-2">
          <QualificationsBlock qualifications={qualifications} careerYears={careerYears} />
        </div>
      </div>
      <div className="mb-8">
        <p className="text-sm font-semibold mb-3">Professional Summary</p>
        <ProfileSummaryCard
          initialSummary={profile.summary}
          hasLLMKey={hasLLMKey}
        />
      </div>
      <ExperienceBlock exp={profile.experiences} />
    </ContentContainer>
  )
}
