import {
  Binoculars,
  ClipboardList,
  Compass,
  FileText,
  HomeIcon,
  Mail,
  MessageSquare,
  UserRound,
  type LucideIcon
} from "lucide-react"

export type NavItem = {
  destination: string
  label: string
  Icon: LucideIcon
}

export const mainNav: NavItem[] = [
  { destination: "/dashboard", label: "Home", Icon: HomeIcon },
  { destination: "/dashboard/onboarding", label: "Search Context", Icon: Compass },
  { destination: "/dashboard/profile", label: "Professional Profile", Icon: UserRound },
  { destination: "/dashboard/job-applications", label: "Job Applications", Icon: ClipboardList },
  { destination: "/dashboard/job-hunt", label: "Job Hunt", Icon: Binoculars },
  { destination: "/dashboard/cv-builder", label: "CV Builder", Icon: FileText },
  { destination: "/dashboard/cover-letters", label: "Cover Letters", Icon: Mail },
  { destination: "/dashboard/interview-prep", label: "Interview Prep", Icon: MessageSquare },
]
