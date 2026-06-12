'use client'

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
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

// ── Types ─────────────────────────────────────────────────────────────────────

type ActivityType = ExperienceWithActivities['activities'][number]

// ── Experience block ──────────────────────────────────────────────────────────

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
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground"
                          aria-label={`Actions for ${experience.company}`}
                        >
                          <MoreHorizontal size={16} />
                        </Button>
                      }
                    />
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

      {open && (
        <ExperienceDialog
          open={open}
          onOpenChange={setOpen}
          onSave={handleCreate}
        />
      )}

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

// ── Add experience card ───────────────────────────────────────────────────────

function ExperienceCard({ onAdd }: { onAdd: () => void }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      className="hover:bg-accent cursor-pointer min-h-[200px]"
      onClick={onAdd}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd() } }}
      aria-label="Add work experience"
    >
      <CardContent className="flex-1 h-full">
        <div className="flex flex-col justify-center items-center h-full rounded-lg border border-primary/80 border-dashed min-h-[160px] gap-1 text-sm text-muted-foreground">
          <Plus size={18} />
          Add Work Experience
        </div>
      </CardContent>
    </Card>
  )
}

// ── Experience add/edit dialog ────────────────────────────────────────────────

export function ExperienceDialog({
  open, onOpenChange, onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSave: (data: Parameters<typeof createExperience>[0]) => void
}) {
  const [remote, setRemote] = useState(false)

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

// ── Activities management dialog ──────────────────────────────────────────────

function ActivityManageDialog({
  open, onOpenChange, experience, onActivitiesChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  experience: ExperienceWithActivities
  onActivitiesChange: (experienceId: string, activities: ActivityType[]) => void
}) {
  const [activities, setActivities] = useState<ActivityType[]>(experience.activities)
  const [formVisible, setFormVisible] = useState(false)
  const [editingActivity, setEditingActivity] = useState<ActivityType | null>(null)
  const [kind, setKind] = useState<string>(RoleActivityKind.Responsibility)
  const [description, setDescription] = useState('')
  const [impact, setImpact] = useState('')

  const openAddForm = () => {
    setEditingActivity(null)
    setKind(RoleActivityKind.Responsibility)
    setDescription('')
    setImpact('')
    setFormVisible(true)
  }

  const openEditForm = (a: ActivityType) => {
    setEditingActivity(a)
    setKind(a.kind)
    setDescription(a.description)
    setImpact(a.impact ?? '')
    setFormVisible(true)
  }

  const closeForm = () => {
    setFormVisible(false)
    setEditingActivity(null)
  }

  const handleSave = async () => {
    if (!description.trim()) return
    const data = { kind, description: description.trim(), impact: impact.trim() || undefined }
    try {
      if (editingActivity) {
        const updated = await updateActivity(editingActivity.id, data)
        const next = activities.map(a => a.id === editingActivity.id ? updated as unknown as ActivityType : a)
        setActivities(next)
        onActivitiesChange(experience.id, next)
      } else {
        const created = await createActivity(experience.id, data)
        const next = [...activities, created as unknown as ActivityType]
        setActivities(next)
        onActivitiesChange(experience.id, next)
      }
      closeForm()
    } catch { }
  }

  const handleDelete = async (id: string) => {
    const prev = activities
    const next = activities.filter(a => a.id !== id)
    setActivities(next)
    onActivitiesChange(experience.id, next)
    try { await deleteActivity(id) } catch {
      setActivities(prev)
      onActivitiesChange(experience.id, prev)
    }
  }

  const grouped = {
    responsibility: activities.filter(a => a.kind === RoleActivityKind.Responsibility),
    achievement: activities.filter(a => a.kind === RoleActivityKind.Achievement),
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activities — {experience.company}</DialogTitle>
          <DialogDescription>{experience.role}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pr-1">
          {(['responsibility', 'achievement'] as const).map(kind => {
            const items = grouped[kind]
            if (items.length === 0) return null
            return (
              <div key={kind}>
                <div className={clsx(
                  "inline-block font-semibold text-xs py-0.5 px-2 rounded-sm mb-2",
                  kind === 'responsibility' ? 'bg-green-400' : 'bg-amber-400'
                )}>
                  {kind === 'responsibility' ? 'Responsibilities' : 'Achievements'}
                </div>
                <div className="space-y-1">
                  {items.map(a => (
                    <div key={a.id} className="group flex items-start gap-2 py-1 rounded hover:bg-accent/50 px-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{a.description}</p>
                        {a.impact && (
                          <p className="text-xs text-muted-foreground mt-0.5">↳ {a.impact}</p>
                        )}
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(a)} aria-label="Edit activity">
                          <Pencil size={11} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => handleDelete(a.id)} aria-label="Delete activity">
                          <Trash2 size={11} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {activities.length === 0 && !formVisible && (
            <p className="text-sm text-muted-foreground text-center py-4">No activities yet.</p>
          )}
        </div>

        {activities.length > 0 && <Separator />}

        {formVisible ? (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {editingActivity ? 'Edit Activity' : 'New Activity'}
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={closeForm}>
                <X size={13} />
              </Button>
            </div>
            <Field>
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => v && setKind(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={RoleActivityKind.Responsibility}>Responsibility</SelectItem>
                  <SelectItem value={RoleActivityKind.Achievement}>Achievement</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What did you do?"
              />
            </Field>
            <Field>
              <Label>Impact <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={impact}
                onChange={e => setImpact(e.target.value)}
                placeholder="Measurable outcome or result..."
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={closeForm}>Cancel</Button>
              <Button size="sm" onClick={handleSave}>
                {editingActivity ? 'Save' : 'Add'}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full gap-1" onClick={openAddForm}>
            <Plus size={14} /> Add Activity
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
