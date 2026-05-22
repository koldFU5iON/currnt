import {
  ClipboardList,
  HomeIcon,
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
  { destination: "/dashboard/job-applications", label: "Job Applications", Icon: ClipboardList },
  { destination: "/dashboard/profile", label: "My Profile", Icon: UserRound },
]
