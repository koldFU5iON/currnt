# Report Issue Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app "Report an issue" button to the dashboard sidebar that lets signed-in users file bugs and ideas directly to the GitHub Issues board.

**Architecture:** A `createFeedbackIssue` server action calls the GitHub Issues API using a server-side `GITHUB_ISSUE_TOKEN` env var. A `FeedbackDrawer` client component manages form state and renders a `Dialog` on desktop (md+) and a vaul `Drawer` on mobile, switching via the existing `useIsMobile()` hook. The sidebar footer gets a `MessageSquareWarning` icon button that controls the drawer's open state.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, shadcn/ui (Dialog — base-ui, Drawer — vaul), Lucide React, Sonner toasts, existing `useIsMobile` hook at `src/hooks/use-mobile.ts`

---

## File Map

| File | Action |
|------|--------|
| `src/components/ui/drawer.tsx` | Create — install via shadcn CLI |
| `src/modules/feedback/actions.ts` | Create — `createFeedbackIssue` server action |
| `src/app/components/FeedbackDrawer.tsx` | Create — responsive Dialog/Drawer form component |
| `src/components/app-sidebar.tsx` | Modify — add `FeedbackButton` to `SidebarFooter` |
| `.env.example` | Modify — add `GITHUB_ISSUE_TOKEN` entry |

---

### Task 1: Install the Drawer component

**Files:**
- Create: `src/components/ui/drawer.tsx` (via CLI)

- [ ] **Step 1: Install**

```bash
npx shadcn@latest add drawer
```

Expected: `src/components/ui/drawer.tsx` created. The command may also install `vaul` into `package.json`.

- [ ] **Step 2: Inspect what was installed**

Read `src/components/ui/drawer.tsx` and note the exact exported names. You will need them in Task 3. The standard exports are:

```ts
Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle,
DrawerDescription, DrawerFooter, DrawerClose
```

Confirm these are present before moving on. If the file exports different names, adjust Task 3 accordingly.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/drawer.tsx package.json package-lock.json
git commit -m "chore: install shadcn Drawer component (vaul)"
```

---

### Task 2: `createFeedbackIssue` server action

**Files:**
- Create: `src/modules/feedback/actions.ts`

- [ ] **Step 1: Create the file**

```ts
'use server'

import { requireProfile } from '@/lib/session'

type FeedbackType = 'bug' | 'idea' | 'other'

export type CreateFeedbackResult =
  | { ok: true }
  | { ok: false; message: string }

const LABEL_MAP: Record<FeedbackType, string[]> = {
  bug: ['bug', 'user-reported'],
  idea: ['enhancement', 'user-reported'],
  other: ['user-reported'],
}

export async function createFeedbackIssue(
  type: FeedbackType,
  title: string,
  description: string,
  currentPath: string,
): Promise<CreateFeedbackResult> {
  const { profile } = await requireProfile()

  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    return { ok: false, message: 'Title is required.' }
  }

  const token = process.env.GITHUB_ISSUE_TOKEN
  if (!token) {
    return { ok: false, message: 'Issue reporting is not configured.' }
  }

  const bodyLines: string[] = []
  if (description.trim()) {
    bodyLines.push(description.trim(), '')
  }
  bodyLines.push(
    '---',
    `**Filed from:** ${currentPath}`,
    `**Reporter:** ${profile.email ?? 'unknown'}`,
    `**Submitted:** ${new Date().toISOString()}`,
  )

  try {
    const res = await fetch('https://api.github.com/repos/koldFU5iON/resume/issues', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        title: trimmedTitle,
        body: bodyLines.join('\n'),
        labels: LABEL_MAP[type],
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`GitHub Issues API error ${res.status}: ${text}`)
      return { ok: false, message: 'GitHub returned an error. Try the fallback link.' }
    }

    return { ok: true }
  } catch (err) {
    console.error('createFeedbackIssue network error:', err)
    return { ok: false, message: 'Network error. Try the fallback link.' }
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/feedback/actions.ts
git commit -m "feat: add createFeedbackIssue server action"
```

---

### Task 3: `FeedbackDrawer` client component

**Files:**
- Create: `src/app/components/FeedbackDrawer.tsx`

Context: `useIsMobile()` lives at `src/hooks/use-mobile.ts` — returns `true` when viewport is `< 768px`. Dialog (desktop) is from `@/components/ui/dialog`, built on `@base-ui/react/dialog`. Drawer (mobile) is from `@/components/ui/drawer`, built on vaul. Both support controlled `open` / `onOpenChange`.

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createFeedbackIssue } from '@/modules/feedback/actions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type FeedbackType = 'bug' | 'idea' | 'other'

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idea' },
  { value: 'other', label: 'Other' },
]

const DESCRIPTION_PLACEHOLDERS: Record<FeedbackType, string> = {
  bug: 'Steps to reproduce, or anything else useful…',
  idea: 'What problem would this solve?…',
  other: 'Any extra context…',
}

const FALLBACK_URL = 'https://github.com/koldFU5iON/resume/issues/new'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDrawer({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile()
  const pathname = usePathname()

  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPending, startTransition] = useTransition()

  function reset() {
    setType('bug')
    setTitle('')
    setDescription('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await createFeedbackIssue(type, title, description, pathname)
      if (result.ok) {
        toast.success('Issue filed — thanks!')
        handleOpenChange(false)
      } else {
        toast.error(result.message, {
          action: {
            label: 'Open on GitHub',
            onClick: () => {
              window.open(
                `${FALLBACK_URL}?title=${encodeURIComponent(title)}`,
                '_blank',
              )
            },
          },
        })
      }
    })
  }

  const typeToggle = (
    <div className="flex gap-1 rounded-md bg-muted p-1">
      {TYPES.map(t => (
        <button
          key={t.value}
          type="button"
          onClick={() => setType(t.value)}
          disabled={isPending}
          className={cn(
            'flex-1 rounded px-3 py-1 text-xs font-medium transition-colors',
            type === t.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )

  const formFields = (
    <div className="space-y-4">
      {typeToggle}
      <div className="space-y-1.5">
        <Label htmlFor="feedback-title">Title</Label>
        <Input
          id="feedback-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Short description…"
          disabled={isPending}
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="feedback-description">
          Description{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="feedback-description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={DESCRIPTION_PLACEHOLDERS[type]}
          rows={3}
          disabled={isPending}
          className="resize-none text-sm"
        />
      </div>
    </div>
  )

  const submitButton = (
    <Button
      type="button"
      size="sm"
      onClick={handleSubmit}
      disabled={isPending || !title.trim()}
    >
      {isPending ? 'Submitting…' : 'Submit report'}
    </Button>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Report an issue</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2">{formFields}</div>
          <DrawerFooter className="flex-row justify-end gap-2">
            <DrawerClose asChild>
              <Button type="button" variant="outline" size="sm" disabled={isPending}>
                Cancel
              </Button>
            </DrawerClose>
            {submitButton}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
        </DialogHeader>
        <div className="px-4">{formFields}</div>
        <DialogFooter>
          {submitButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Note on `DrawerClose asChild`:** If the installed `drawer.tsx` does not support `asChild`, replace:
```tsx
<DrawerClose asChild>
  <Button type="button" variant="outline" size="sm" disabled={isPending}>
    Cancel
  </Button>
</DrawerClose>
```
with:
```tsx
<DrawerClose>
  <Button type="button" variant="outline" size="sm" disabled={isPending}>
    Cancel
  </Button>
</DrawerClose>
```
or remove the Cancel button entirely since the Drawer's drag handle already dismisses it.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors. If TypeScript complains about `DrawerClose asChild`, apply the fallback from the note above.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/FeedbackDrawer.tsx
git commit -m "feat: add FeedbackDrawer component"
```

---

### Task 4: Wire into sidebar and update env

**Files:**
- Modify: `src/components/app-sidebar.tsx`
- Modify: `.env.example`

Context: `app-sidebar.tsx` currently has a `SidebarFooter` containing one `SidebarMenuItem` that wraps `<UserMenu />`. Add a `FeedbackButton` component above it. `FeedbackButton` manages `open` state locally and renders the drawer.

- [ ] **Step 1: Update the sidebar**

Add `useState` to the React import, add `MessageSquareWarning` to the lucide import, add the `FeedbackDrawer` import, and add a `FeedbackButton` function. Then update `SidebarFooter` to render it.

The full updated `src/components/app-sidebar.tsx`:

```tsx
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
```

- [ ] **Step 2: Update `.env.example`**

Add this block after the `ENCRYPTION_KEY` line:

```env
# GitHub Issues — fine-grained PAT with Issues: Read & Write on koldFU5iON/resume
# Create at https://github.com/settings/tokens?type=beta
GITHUB_ISSUE_TOKEN=""
```

Also add `GITHUB_ISSUE_TOKEN=""` to your local `.env.local` (and set the real token value).

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/app-sidebar.tsx .env.example
git commit -m "feat: wire FeedbackDrawer into sidebar footer"
```

---

## Manual Verification

Start the dev server (`npm run dev`) and verify:

1. The sidebar shows a `MessageSquareWarning` icon below nav items and above the user chip — tooltip says "Report an issue".
2. When the sidebar is collapsed to icon-only mode, the icon remains visible with tooltip.
3. Clicking the icon opens:
   - A bottom-sheet Drawer on a narrow viewport (< 768px)
   - A centered Dialog on desktop
4. The type toggle switches between Bug / Idea / Other and the description placeholder updates.
5. The Submit button is disabled when the title is empty; enabled once a non-whitespace character is typed.
6. With `GITHUB_ISSUE_TOKEN` set to a valid PAT: submit a test issue — confirm it appears on `https://github.com/koldFU5iON/resume/issues` with the correct label(s) and `user-reported`, the issue body includes the path and email.
7. After successful submission: toast "Issue filed — thanks!" fires and the form closes and resets to Bug / empty.
8. With `GITHUB_ISSUE_TOKEN` unset or invalid: toast "Issue reporting is not configured." (or error message) with an "Open on GitHub" action that opens the new-issue URL with the title pre-filled.
