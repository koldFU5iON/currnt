import { ContentContainer } from "@/app/components/ContentContainer";
import { Profile } from "./_components/Profile";
import type { ProfileType } from "@/app/types/job-application";

{/* Example Profile

Devon Stanton
Senior Program Manager | Operational Transformation & Delivery
Program Governance • Multi-Stream Delivery • Operational Change & Adoption
devon.stanton@gmail.com | linkedin.com/in/devonstanton | www.devonstanton.com

  */}

const profileData: ProfileType = {
  name: "Devon Stanton",
  headline: [
    "Senior Program Manager",
    "Operational Transformation & Delivery"
  ],
  subHeadline: [
    "Program Governance",
    "Multi-Stream Delivery",
    "Operational Change & Adoption"
  ],
  links: [
    { name: "LinkedIn", url: "linkedin.com/in/devonstanton" },
    { name: "website", url: "devonstanton.com" },
  ],
  contact: [
    { type: "phone", value: "+33 6 10 03 62 95" },
    { type: "email", value: "devon.stanton@gmail.com" }
  ],
  about: (`
Senior program manager who owns large- scale operational transformation end to end, from integrated planning through go-live, adoption, and the post - launch window where new ways of working have to hold. 15 + years across global technology and entertainment companies, including Unity Technologies and Blizzard Entertainment, delivering in live - operational environments where programs ship to fixed deadlines and change lands on real people doing real jobs.

Works across engineering, marketing, legal, finance, and operations without direct - line authority, equally comfortable at Steering Committee level and in the delivery detail.Advises senior leadership through high - stakes change and turns ambiguous briefs into structured programs that run reliably without constant management.
  `),
  competency: [
    "competency 1",
    "competency 2",
    "competency 3"
  ],

}

export default function Page() {
  return (
    <ContentContainer title="My Profile" description="The profile page is where you would outline your entire career profile and history. This is a deep dive into who you are as a professional">
      <Profile profile={profileData} />
    </ContentContainer>)
}
