'use client'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ChevronsUpDown,
  ClipboardList,
  FileText,
  HomeIcon,
  LogOut,
  LucideIcon,
  Settings,
  User,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

type NavItem = {
  destination: string
  label: string
  Icon: LucideIcon
}

const mainNav: NavItem[] = [
  { destination: "/dashboard", label: "Home", Icon: HomeIcon },
  { destination: "/dashboard/job-applications", label: "Job Applications", Icon: ClipboardList },
]

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/dashboard">
              <SidebarMenuButton size="lg" tooltip="Resume">
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-sm">Resume</span>
                  <span className="text-xs text-muted-foreground">Job Tracker</span>
                </div>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <NavMenuItem key={item.destination} {...item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip="Devon Stanton">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-muted">
                    <User className="size-4" />
                  </div>
                  <div className="flex flex-col text-left flex-1">
                    <span className="font-medium text-sm">Devon Stanton</span>
                    <span className="text-xs text-muted-foreground">devon.stanton@gmail.com</span>
                  </div>
                  <ChevronsUpDown className="size-4 ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <Settings className="size-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <User className="size-4" />
                    Profile
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut className="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function NavMenuItem({ destination, label, Icon }: NavItem) {
  const pathname = usePathname()
  const isActive =
    destination === "/dashboard"
      ? pathname === destination
      : pathname.startsWith(destination)

  return (
    <SidebarMenuItem>
      <Link href={destination}>
        <SidebarMenuButton isActive={isActive} tooltip={label}>
          <Icon />
          <span>{label}</span>
        </SidebarMenuButton>
      </Link>
    </SidebarMenuItem>
  )
}
