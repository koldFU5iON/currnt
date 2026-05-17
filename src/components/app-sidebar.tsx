import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ClipboardList, HomeIcon, LucideIcon } from "lucide-react"
import Link from 'next/link';


export function AppSidebar() {
  return (
    <Sidebar variant="sidebar">
      <SidebarHeader >
        Resume
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup >
          <MenuItem destination="/dashboard" label="Home" Icon={HomeIcon} />
          <MenuItem destination="/dashboard/job-applications" label="Job Applications" Icon={ClipboardList} />
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter >
        Devon Stanton
      </SidebarFooter>
    </Sidebar>
  )
}

type MenuItemProps = {
  destination: string
  Icon?: LucideIcon
  label: string
}

export function MenuItem({ destination, label, Icon }: MenuItemProps) {
  return (
    <Link href={destination}>
      <SidebarMenuItem>
        <SidebarMenuButton>
          {Icon && <Icon />} {label}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </Link>
  )
}
