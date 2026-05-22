import type { ProfileType } from "@/app/types/job-application";
import { Separator } from "@/components/ui/separator";

export function Profile({ profile }: { profile: ProfileType }) {
  return (
    <div className="p-5 bg-background rounded-md">
      <section className="border-b border-primary pb-3">
        <div className="text-2xl font-semibold">
          {profile.name}
        </div>
        <div className="text-lg">
          {profile.headline.join(" | ")}
        </div>
        <div className="font-bold text-md">
          {profile.subHeadline.join(" • ")}
        </div>
        <div className="flex">
          <div>
            {profile.contact.map(contact => contact.value).join(" | ")}
          </div>
          <Separator orientation="vertical" className="mx-2" />
          <div>
            {profile.links.map(link => link.url).join(" | ")}
          </div>
        </div>
      </section>
      <ProfileSection title="Professional Profile">
        <div>
          {profile.about}
        </div>
      </ProfileSection>
      <ProfileSection title="Core Competencies" >
        <div className="flex flex-col">
          {profile.competency.map(competency => (
            <div className="even:bg-accent">
              {competency}
            </div>
          ))}
        </div>
      </ProfileSection>
      <ProfileSection title="Career Highlights">
        new section
      </ProfileSection>
    </div>

  )
}

type ProfileSectionProps = {
  children: React.ReactNode
  title: string
}

function ProfileSection({ children, title }: ProfileSectionProps) {
  return (
    <section className="my-2" >
      <div className="text-xl font-bold mb-1">
        {title}
      </div>
      <div className="px-5">
        {children}
      </div>
    </section>
  )
}
