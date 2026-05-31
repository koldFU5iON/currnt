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
  FileText,
  LogOut,
  MessageSquareWarning,
  Settings,
  User,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { authClient, useSession } from "@/lib/auth-client"
import { mainNav, type NavItem } from "@/lib/nav-menu"
import { FeedbackDrawer } from "@/app/components/FeedbackDrawer"
import { Wordmark } from "@/components/brand/wordmark"

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
                  <Wordmark size="sm" />
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
          <FeedbackButton />
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function FeedbackButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={() => setOpen(true)} tooltip="Report an issue">
          <MessageSquareWarning />
          <span>Report an issue</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <FeedbackDrawer open={open} onOpenChange={setOpen} />
    </>
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

function UserMenu() {
  const router = useRouter()
  const { data: session, isPending } = useSession()

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  const name = session?.user.name ?? (isPending ? "Loading..." : "Signed out")
  const email = session?.user.email ?? ""

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton size="lg" tooltip={name}>
            <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-muted">
              <User className="size-4" />
            </div>
            <div className="flex flex-col text-left flex-1 overflow-hidden">
              <span className="font-medium text-sm truncate">{name}</span>
              {email && <span className="text-xs text-muted-foreground truncate">{email}</span>}
            </div>
            <ChevronsUpDown className="size-4 ml-auto" />
          </SidebarMenuButton>
        }
      />
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <Link href="/dashboard/settings">
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
          </Link>
          <DropdownMenuItem disabled>
            <User className="size-4" />
            Profile
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
