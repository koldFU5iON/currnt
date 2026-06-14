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
  Coins,
  LogOut,
  MessageSquareWarning,
  Settings,
  User,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { authClient, useSession } from "@/lib/auth-client"
import { navGroups, type NavItem } from "@/lib/nav-menu"
import { brand } from "@/lib/brand"
import { FeedbackDrawer } from "@/app/components/FeedbackDrawer"
import { Wordmark } from "@/components/brand/wordmark"
import { CurrntIcon } from "@/components/brand/icon"
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog"
import { Support } from "./support"
import { cn } from "@/lib/utils"
import { usePageContext } from "@/lib/context/page-context"
import type { ActiveJobForNav } from "@/modules/jobs/queries"

export function AppSidebar({ activeJobs }: { activeJobs: ActiveJobForNav[] }) {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/dashboard">
              {/* tooltip={brand.name} is the accessible label when the sidebar is collapsed — keep it */}
              <SidebarMenuButton size="lg" tooltip={brand.name}>
                <div className="flex aspect-square size-8 items-center justify-center">
                  <CurrntIcon size={22} />
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
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavMenuItem key={item.destination} {...item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup>
          <SidebarGroupLabel>Active Jobs</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {activeJobs.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No active jobs</p>
              ) : (
                activeJobs.map(job => <ActiveJobMenuItem key={job.id} job={job} />)
              )}
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

function ActiveJobMenuItem({ job }: { job: ActiveJobForNav }) {
  const pathname = usePathname()
  const { context } = usePageContext()
  // highlight if on this job's hub page OR if the page context has this job's ID
  const contextJobId = context && 'jobId' in context ? context.jobId : undefined
  const isActive =
    pathname.startsWith(`/dashboard/job-applications/view/${job.id}`) ||
    contextJobId === job.id

  const statusColour = job.status === 'interviewing'
    ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
    : 'bg-amber-500/20 text-amber-600 dark:text-amber-500'

  return (
    <SidebarMenuItem>
      <Link href={`/dashboard/job-applications/view/${job.id}`}>
        <SidebarMenuButton isActive={isActive} tooltip={`${job.company ?? ''} — ${job.title}`}>
          <span className="min-w-0 flex-1 truncate text-xs">
            {job.company ? `${job.company} · ` : ''}{job.title}
          </span>
          <span className={cn('shrink-0 rounded px-1 py-0.5 text-[10px] font-medium capitalize', statusColour)}>
            {job.status === 'interviewing' ? 'interview' : 'progress'}
          </span>
        </SidebarMenuButton>
      </Link>
    </SidebarMenuItem>
  )
}

function FeedbackButton() {
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <>
      <SidebarMenuItem>
        <Dialog>
          <DialogTrigger
            render={
              <SidebarMenuButton tooltip="Support currnt development">
                <Coins />
                <span>Support currnt</span>
              </SidebarMenuButton>
            }
          />
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-4xl max-h-[85vh] overflow-y-auto">
            <Support className="px-2 py-4" />
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton onClick={() => setFeedbackOpen(true)} tooltip="Report an issue">
          <MessageSquareWarning />
          <span>Report an issue</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <FeedbackDrawer open={feedbackOpen} onOpenChange={setFeedbackOpen} />
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
