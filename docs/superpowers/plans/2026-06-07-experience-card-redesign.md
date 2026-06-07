# Experience Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make experience cards fully accessible on mobile by replacing the hover-only action buttons with an always-visible DropdownMenu, replacing the noisy activity list with count chips + 2 previews, adding a delete confirmation dialog, fixing the ActivityManageDialog hover buttons, and replacing the raw checkbox in ExperienceDialog with the shadcn Checkbox.

**Architecture:** All changes are contained in a single file — `src/app/dashboard/profile/_components/Experience.tsx`. A new `AlertDialog` shadcn component is installed first. The `CardFooter` is removed entirely and replaced with a `DropdownMenu` trigger anchored in the `CardHeader`. Delete confirmation is managed via a single `deleteConfirmId: string | null` state at the `ExperienceBlock` level.

**Tech Stack:** Next.js 16 App Router, shadcn/ui (DropdownMenu, AlertDialog, Checkbox), Lucide icons, Tailwind CSS v4

**Branch:** `fix/quick-issues-97-113-126` (already open)

---

## File Map

**Modified:**
- `src/app/dashboard/profile/_components/Experience.tsx` — all UI changes
- `src/components/ui/alert-dialog.tsx` — new file, created by shadcn CLI

---

## Task 1: Install AlertDialog

**Files:**
- Create: `src/components/ui/alert-dialog.tsx`

- [ ] **Step 1: Run shadcn install**

```bash
npx shadcn@latest add alert-dialog
```

Expected output: `✔ Done!` — creates `src/components/ui/alert-dialog.tsx`.

- [ ] **Step 2: Verify the file exists**

```bash
ls src/components/ui/alert-dialog.tsx
```

Expected: file path printed, no error.

---

## Task 2: Update imports in Experience.tsx

**Files:**
- Modify: `src/app/dashboard/profile/_components/Experience.tsx`

The current import block needs these changes:
- **Remove:** `CardFooter` (card footer is deleted), `buttonVariants` (no longer used), `Link` from next/link (replaced by `router.push`)
- **Remove from lucide:** `ListChecks` moves to the dropdown but we keep it; remove nothing from lucide actually — add `MoreHorizontal`
- **Add:** DropdownMenu family, AlertDialog family, Checkbox

- [ ] **Step 1: Replace the import block at the top of the file**

Replace everything from line 1 through the last import line with:

```tsx
'use client'

import { useRouter } from "next/navigation"
import { useState, useEffect, type FormEvent } from "react"
import {
  Card, CardHeader, CardContent, CardDescription, CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Calendar, ListChecks, MapPin, MoreHorizontal,
  Pencil, Plus, Trash2, X
} from "lucide-react"
import { ExperienceWithActivities, RoleActivityKind } from "@/app/types/profile"
import { H } from "@/app/components/style/Style"
import clsx from "clsx"
import {
  createExperience, deleteExperience,
  createActivity, updateActivity, deleteActivity,
} from "@/modules/profile/actions"
```

- [ ] **Step 2: Verify typecheck passes (catches missing imports early)**

```bash
npm run typecheck 2>&1 | head -20
```

Expected: errors only about `deleteConfirmId` not existing yet (fine at this stage) or clean. No "module not found" errors.

---

## Task 3: Add deleteConfirmId state and refactor ExperienceBlock

**Files:**
- Modify: `src/app/dashboard/profile/_components/Experience.tsx`

- [ ] **Step 1: Replace the `ExperienceBlock` function**

Replace the entire `ExperienceBlock` function (lines 37–178) with:

```tsx
export function ExperienceBlock({ exp }: { exp: ExperienceWithActivities[] }) {
  const router = useRouter()
  const [experiences, setExperiences] = useState(exp)
  const [open, setOpen] = useState(false)
  const [activitiesFor, setActivitiesFor] = useState<ExperienceWithActivities | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const deleteTarget = experiences.find(e => e.id === deleteConfirmId)

  const handleDelete = async (id: string) => {
    const prev = experiences
    setExperiences(e => e.filter(e => e.id !== id))
    setDeleteConfirmId(null)
    try { await deleteExperience(id) } catch { setExperiences(prev) }
  }

  const handleCreate = async (data: Parameters<typeof createExperience>[0]) => {
    setOpen(false)
    try {
      const created = await createExperience(data)
      router.push(`/dashboard/profile/experience/${created.id}`)
    } catch { }
  }

  const handleActivitiesChange = (experienceId: string, activities: ActivityType[]) => {
    setExperiences(e => e.map(x =>
      x.id === experienceId ? { ...x, activities } : x
    ))
    setActivitiesFor(prev => prev?.id === experienceId ? { ...prev, activities } : prev)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <H size={2}>Experience</H>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setOpen(true)}>
          <Plus size={12} /> Add
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 bg-background p-4">
        {experiences.map(experience => {
          const responsibilities = experience.activities.filter(a => a.kind === RoleActivityKind.Responsibility)
          const achievements = experience.activities.filter(a => a.kind === RoleActivityKind.Achievement)
          const firstResp = responsibilities[0]
          const firstAchv = achievements[0]

          return (
            <Card className="bg-accent" key={experience.id}>
              <CardHeader className="border-b border-primary/80">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <CardTitle>
                      <H size={3}>{experience.company}</H>
                    </CardTitle>
                    <CardDescription className="w-full">
                      {experience.location && (
                        <div className="flex text-sm items-center gap-1">
                          <MapPin size={12} className="text-red-500 shrink-0" />
                          {experience.location}
                          {experience.remote && (
                            <span className="ml-1 text-xs text-muted-foreground">(Remote)</span>
                          )}
                        </div>
                      )}
                      <H size={4}>{experience.role}</H>
                      <div className="flex items-center mt-1 gap-1 text-xs">
                        <Calendar size={12} />
                        <span>{experience.startDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                        <span>–</span>
                        <span>
                          {experience.endDate
                            ? experience.endDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                            : 'Present'}
                        </span>
                      </div>
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground"
                        aria-label={`Actions for ${experience.company}`}
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/dashboard/profile/experience/${experience.id}`)}>
                        <Pencil size={13} className="mr-2" /> Edit details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActivitiesFor(experience)}>
                        <ListChecks size={13} className="mr-2" /> Manage activities
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteConfirmId(experience.id)}
                      >
                        <Trash2 size={13} className="mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {experience.activities.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No activities yet.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {responsibilities.length > 0 && (
                        <span className="inline-block font-semibold text-xs py-0.5 px-2 rounded-sm bg-green-400">
                          {responsibilities.length} {responsibilities.length === 1 ? 'Responsibility' : 'Responsibilities'}
                        </span>
                      )}
                      {achievements.length > 0 && (
                        <span className="inline-block font-semibold text-xs py-0.5 px-2 rounded-sm bg-amber-400">
                          {achievements.length} {achievements.length === 1 ? 'Achievement' : 'Achievements'}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1">
                      {firstResp && (
                        <li className="text-xs text-muted-foreground pl-2 border-l-2 border-green-400 line-clamp-2">
                          {firstResp.description}
                        </li>
                      )}
                      {firstAchv && (
                        <li className="text-xs text-muted-foreground pl-2 border-l-2 border-amber-400 line-clamp-2">
                          {firstAchv.description}
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
        <ExperienceCard onAdd={() => setOpen(true)} />
      </div>

      <ExperienceDialog
        open={open}
        onOpenChange={setOpen}
        onSave={handleCreate}
      />

      {activitiesFor && (
        <ActivityManageDialog
          open={!!activitiesFor}
          onOpenChange={(o) => { if (!o) setActivitiesFor(null) }}
          experience={activitiesFor}
          onActivitiesChange={handleActivitiesChange}
        />
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.company ?? 'this role'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this role and all its activities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteConfirmId) handleDelete(deleteConfirmId) }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck 2>&1 | grep "Experience.tsx"
```

Expected: no errors from `Experience.tsx` at this point. (Other file errors are pre-existing and unrelated.)

---

## Task 4: Fix ActivityManageDialog hover-only buttons

**Files:**
- Modify: `src/app/dashboard/profile/_components/Experience.tsx` — `ActivityManageDialog` function

The activity row currently has `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity` on the button container. Remove that, and shrink buttons from `h-8 w-8` to `h-7 w-7`.

- [ ] **Step 1: Update the activity row button container and button sizes**

Find this block inside `ActivityManageDialog` (the `items.map(a => ...)` render):

```tsx
<div className="flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditForm(a)} aria-label="Edit activity">
    <Pencil size={11} />
  </Button>
  <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(a.id)} aria-label="Delete activity">
    <Trash2 size={11} />
  </Button>
</div>
```

Replace with:

```tsx
<div className="flex gap-0.5 shrink-0">
  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(a)} aria-label="Edit activity">
    <Pencil size={11} />
  </Button>
  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => handleDelete(a.id)} aria-label="Delete activity">
    <Trash2 size={11} />
  </Button>
</div>
```

---

## Task 5: Fix ExperienceDialog — replace raw checkbox with Checkbox

**Files:**
- Modify: `src/app/dashboard/profile/_components/Experience.tsx` — `ExperienceDialog` function

The raw `<input type="checkbox">` doesn't submit its value via the shadcn `Checkbox` component, so we need local state.

- [ ] **Step 1: Replace the `ExperienceDialog` function**

Replace the entire `ExperienceDialog` function with:

```tsx
function ExperienceDialog({
  open, onOpenChange, onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSave: (data: Parameters<typeof createExperience>[0]) => void
}) {
  const [remote, setRemote] = useState(false)

  useEffect(() => {
    if (!open) setRemote(false)
  }, [open])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const endDateStr = fd.get('endDate') as string
    onSave({
      company: fd.get('company') as string,
      role: fd.get('role') as string,
      location: (fd.get('location') as string) || undefined,
      remote,
      startDate: new Date(fd.get('startDate') as string),
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      summary: '',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Experience</DialogTitle>
          <DialogDescription>
            Add the basics — you can fill in notes and activities on the next page.
          </DialogDescription>
        </DialogHeader>
        <form key="new" onSubmit={handleSubmit}>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label htmlFor="exp-company">Company</Label>
                <Input id="exp-company" name="company" required />
              </Field>
              <Field>
                <Label htmlFor="exp-role">Role / Title</Label>
                <Input id="exp-role" name="role" required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label htmlFor="exp-location">Location</Label>
                <Input id="exp-location" name="location" placeholder="City, Country" />
              </Field>
              <Field>
                <div className="flex items-center gap-2 mt-6">
                  <Checkbox
                    id="exp-remote"
                    checked={remote}
                    onCheckedChange={(checked) => setRemote(!!checked)}
                  />
                  <Label htmlFor="exp-remote">Remote position</Label>
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label htmlFor="exp-start">Start Date</Label>
                <Input id="exp-start" name="startDate" type="date" required />
              </Field>
              <Field>
                <Label htmlFor="exp-end">End Date</Label>
                <Input id="exp-end" name="endDate" type="date" />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" variant="secondary">Cancel</Button>} />
            <Button type="submit">Add & Open</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Task 6: Typecheck, verify, and commit

**Files:**
- All changes are in `src/app/dashboard/profile/_components/Experience.tsx`

- [ ] **Step 1: Full typecheck**

```bash
npm run typecheck 2>&1
```

Expected: clean (no errors).

- [ ] **Step 2: Run tests**

```bash
npm test 2>&1 | tail -8
```

Expected: all tests pass (no tests exist for this component — just confirm nothing else broke).

- [ ] **Step 3: Manual smoke test — start dev server and verify**

```bash
npm run dev
```

Navigate to `http://localhost:3000/dashboard/profile` and verify:

- Each experience card shows the ⋯ button in the header (always visible, not hover-dependent)
- Tapping/clicking ⋯ shows: Edit details, Manage activities, (separator), Delete
- "Edit details" navigates to `/dashboard/profile/experience/[id]`
- "Manage activities" opens the ActivityManageDialog
- "Delete" opens the AlertDialog confirmation — Cancel dismisses, Delete removes the card
- Card body shows count chips + up to 2 activity previews (green/amber borders)
- Roles with no activities show "No activities yet."
- Inside ActivityManageDialog, edit and delete buttons on activity rows are always visible (no hover needed)
- "Add Experience" dialog — Remote checkbox works (toggle on/off)

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/profile/_components/Experience.tsx src/components/ui/alert-dialog.tsx
git commit -m "$(cat <<'EOF'
fix(profile): mobile-accessible experience cards (#115)

- Replace hover-only CardFooter with always-visible DropdownMenu (⋯)
  in the card header — Edit, Manage activities, Delete all reachable on touch
- Add AlertDialog delete confirmation so roles can't be removed by accident
- Replace scrollable activity list in card body with count chips + 2
  activity previews (first responsibility + first achievement)
- Fix ActivityManageDialog: always-visible edit/delete buttons on activity rows
- Replace raw <input type="checkbox"> with shadcn Checkbox in ExperienceDialog

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Expected output: commit hash printed, branch name shown.
