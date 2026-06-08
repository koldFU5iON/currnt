import {
  ClipboardList,
  Compass,
  FileText,
  HomeIcon,
  Mail,
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
  { destination: "/dashboard/cv-builder", label: "CV Builder", Icon: FileText },
  { destination: "/dashboard/cover-letters", label: "Cover Letters", Icon: Mail },
]
