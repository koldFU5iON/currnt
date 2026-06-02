'use client'

import { useState, type FormEvent } from "react"
import { QualificationsType } from "../page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, FieldGroup } from "@/components/ui/field"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { H } from "@/app/components/style/Style"
import { Pencil, Plus, Trash2 } from "lucide-react"
import {
  createSkill, updateSkill, deleteSkill,
  createLanguage, updateLanguage, deleteLanguage,
  createEducation, updateEducation, deleteEducation,
  createCertification, updateCertification, deleteCertification,
} from "@/modules/profile/actions"

// ── Types ─────────────────────────────────────────────────────────────────────

type SkillType = QualificationsType['skills'][number]
type LanguageType = QualificationsType['tools'][number]
type EducationType = QualificationsType['education'][number]
type CertType = QualificationsType['certifications'][number]

// ── Helpers ───────────────────────────────────────────────────────────────────

const proficiencyVariant: Record<string, "success" | "info" | "warning"> = {
  native: "success",
  fluent: "success",
  professional: "info",
  intermediate: "warning",
}

const toDateInput = (d?: Date | null) =>
  d ? new Date(d).toISOString().split('T')[0] : ''

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <H size={4}>{title}</H>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onAdd} aria-label={`Add ${title}`}>
        <Plus size={12} /> Add
      </Button>
    </div>
  )
}

// ── Row hover controls ────────────────────────────────────────────────────────

function RowControls({ onEdit, onDelete, label }: { onEdit: () => void; onDelete: () => void; label: string }) {
  return (
    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label={`Edit ${label}`}>
        <Pencil size={12} />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={onDelete} aria-label={`Delete ${label}`}>
        <Trash2 size={12} />
      </Button>
    </div>
  )
}

// ── Radial gauge ─────────────────────────────────────────────────────────────

function RadialGauge({ years, totalYears }: { years: number; totalYears: number }) {
  const size = 36
  const strokeWidth = 3
  const r = 13
  const cx = 18
  const cy = 18
  const circumference = 2 * Math.PI * r

  const arcLength = circumference * 0.75
  const gapLength = circumference * 0.25

  const pct = totalYears > 0 ? Math.min(Math.max(years / totalYears, 0), 1) : 0
  const filledLength = pct * arcLength

  // oklch: light green (L≈0.76) → dark green (L≈0.40) as experience ratio increases
  const l = (0.76 - pct * 0.36).toFixed(3)
  const color = `oklch(${l} 0.13 142)`

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${years} of ${totalYears} years experience`}>
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${arcLength.toFixed(2)} ${gapLength.toFixed(2)}`}
        transform={`rotate(135, ${cx}, ${cy})`}
      />
      {pct > 0 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filledLength.toFixed(2)} ${(circumference - filledLength).toFixed(2)}`}
          transform={`rotate(135, ${cx}, ${cy})`}
        />
      )}
      <text
        x={cx} y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="8"
        fontWeight="700"
        fill="currentColor"
      >
        {years}y
      </text>
    </svg>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptySection({ noun, onAdd }: { noun: string; onAdd: () => void }) {
  return (
    <div className="py-5 text-center space-y-2">
      <p className="text-sm text-muted-foreground">No {noun} added yet.</p>
      <Button variant="outline" size="sm" onClick={onAdd}>Add your first {noun.replace(/s$/, '')}</Button>
    </div>
  )
}

// ── Top-level block ───────────────────────────────────────────────────────────

export function QualificationsBlock({ qualifications, careerYears }: { qualifications: QualificationsType; careerYears: number }) {
  const { skills, education, certifications, tools } = qualifications
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <section><SkillsSection initial={skills} careerYears={careerYears} /></section>
      <section><LanguagesSection initial={tools} /></section>
      <section><EducationSection initial={education} /></section>
      <section><CertificationsSection initial={certifications} /></section>
    </div>
  )
}

// ── Skills ────────────────────────────────────────────────────────────────────

function SkillsSection({ initial, careerYears }: { initial: SkillType[]; careerYears: number }) {
  const [skills, setSkills] = useState(initial)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SkillType | null>(null)
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setEditing(null); setOpen(true) }
  const openEdit = (s: SkillType) => { setEditing(s); setOpen(true) }

  const handleDelete = async (id: string) => {
    const prev = skills
    setSkills(s => s.filter(s => s.id !== id))
    try { await deleteSkill(id) } catch { setSkills(prev) }
  }

  const handleSave = async (data: Parameters<typeof createSkill>[0]) => {
    setSaving(true)
    try {
      if (editing) {
        const updated = await updateSkill(editing.id, data)
        setSkills(s => s.map(x => x.id === editing.id ? updated as unknown as SkillType : x))
      } else {
        const created = await createSkill(data)
        setSkills(s => [...s, created as unknown as SkillType])
      }
      setOpen(false)
    } catch { } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeader title="Skills" onAdd={openAdd} />
      {skills.length === 0
        ? <EmptySection noun="skills" onAdd={openAdd} />
        : (
          <div className="space-y-1">
            {skills.map(skill => (
              <div key={skill.id} className="group flex items-center gap-2 py-0.5">
                <span className="text-sm font-medium flex-1 min-w-0 truncate">{skill.name}</span>
                {skill.yearsOfExperience != null && (
                  <RadialGauge years={skill.yearsOfExperience} totalYears={careerYears} />
                )}
                <Badge variant="outline" className="text-xs shrink-0">{skill.level}</Badge>
                <RowControls label={skill.name} onEdit={() => openEdit(skill)} onDelete={() => handleDelete(skill.id)} />
              </div>
            ))}
          </div>
        )
      }
      <SkillDialog key={editing?.id ?? 'new'} open={open} onOpenChange={setOpen} editing={editing} onSave={handleSave} saving={saving} />
    </div>
  )
}

function SkillDialog({
  open, onOpenChange, editing, onSave, saving,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editing: SkillType | null
  onSave: (data: Parameters<typeof createSkill>[0]) => void
  saving: boolean
}) {
  const [level, setLevel] = useState(editing?.level?.toLowerCase() ?? 'intermediate')

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const yoe = fd.get('yearsOfExperience') as string
    onSave({
      name: fd.get('name') as string,
      category: fd.get('category') as string,
      level,
      yearsOfExperience: yoe ? Number(yoe) : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Skill' : 'Add Skill'}</DialogTitle>
        </DialogHeader>
        <form key={editing?.id ?? 'new'} onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <Label htmlFor="skill-name">Name</Label>
              <Input id="skill-name" name="name" defaultValue={editing?.name} required />
            </Field>
            <Field>
              <Label htmlFor="skill-category">Category</Label>
              <Input id="skill-category" name="category" placeholder="e.g. Backend, DevOps" defaultValue={editing?.category} required />
            </Field>
            <Field>
              <Label>Level</Label>
              <Select value={level} onValueChange={(v) => v && setLevel(v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['beginner', 'intermediate', 'advanced', 'expert'].map(l => (
                    <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="skill-yoe">Years of Experience</Label>
              <Input id="skill-yoe" name="yearsOfExperience" type="number" min="0" step="0.5" defaultValue={editing?.yearsOfExperience ?? ''} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" variant="secondary" disabled={saving}>Cancel</Button>} />
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Languages ─────────────────────────────────────────────────────────────────

function LanguagesSection({ initial }: { initial: LanguageType[] }) {
  const [languages, setLanguages] = useState(initial)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LanguageType | null>(null)
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setEditing(null); setOpen(true) }
  const openEdit = (l: LanguageType) => { setEditing(l); setOpen(true) }

  const handleDelete = async (id: string) => {
    const prev = languages
    setLanguages(l => l.filter(l => l.id !== id))
    try { await deleteLanguage(id) } catch { setLanguages(prev) }
  }

  const handleSave = async (data: Parameters<typeof createLanguage>[0]) => {
    setSaving(true)
    try {
      if (editing) {
        const updated = await updateLanguage(editing.id, data)
        setLanguages(l => l.map(x => x.id === editing.id ? updated as unknown as LanguageType : x))
      } else {
        const created = await createLanguage(data)
        setLanguages(l => [...l, created as unknown as LanguageType])
      }
      setOpen(false)
    } catch { } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeader title="Languages" onAdd={openAdd} />
      {languages.length === 0
        ? <EmptySection noun="languages" onAdd={openAdd} />
        : (
          <div className="space-y-1">
            {languages.map(lang => (
              <div key={lang.id} className="group flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-sm font-medium">{lang.name}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant={proficiencyVariant[lang.proficiency] ?? "secondary"} className="text-xs capitalize">
                    {lang.proficiency}
                  </Badge>
                  <RowControls label={lang.name} onEdit={() => openEdit(lang)} onDelete={() => handleDelete(lang.id)} />
                </div>
              </div>
            ))}
          </div>
        )
      }
      <LanguageDialog key={editing?.id ?? 'new'} open={open} onOpenChange={setOpen} editing={editing} onSave={handleSave} saving={saving} />
    </div>
  )
}

function LanguageDialog({
  open, onOpenChange, editing, onSave, saving,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editing: LanguageType | null
  onSave: (data: Parameters<typeof createLanguage>[0]) => void
  saving: boolean
}) {
  const [proficiency, setProficiency] = useState(editing?.proficiency ?? 'intermediate')

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onSave({ name: fd.get('name') as string, proficiency })
  }

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Language' : 'Add Language'}</DialogTitle>
        </DialogHeader>
        <form key={editing?.id ?? 'new'} onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <Label htmlFor="lang-name">Language</Label>
              <Input id="lang-name" name="name" defaultValue={editing?.name} required />
            </Field>
            <Field>
              <Label>Proficiency</Label>
              <Select value={proficiency} onValueChange={(v) => v && setProficiency(v as typeof proficiency)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['native', 'fluent', 'professional', 'intermediate', 'basic'].map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" variant="secondary" disabled={saving}>Cancel</Button>} />
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Education ─────────────────────────────────────────────────────────────────

function EducationSection({ initial }: { initial: EducationType[] }) {
  const [educations, setEducations] = useState(initial)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<EducationType | null>(null)
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setEditing(null); setOpen(true) }
  const openEdit = (e: EducationType) => { setEditing(e); setOpen(true) }

  const handleDelete = async (id: string) => {
    const prev = educations
    setEducations(e => e.filter(e => e.id !== id))
    try { await deleteEducation(id) } catch { setEducations(prev) }
  }

  const handleSave = async (data: Parameters<typeof createEducation>[0]) => {
    setSaving(true)
    try {
      if (editing) {
        const updated = await updateEducation(editing.id, data)
        setEducations(e => e.map(x => x.id === editing.id ? updated as unknown as EducationType : x))
      } else {
        const created = await createEducation(data)
        setEducations(e => [...e, created as unknown as EducationType])
      }
      setOpen(false)
    } catch { } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeader title="Education" onAdd={openAdd} />
      {educations.length === 0
        ? <EmptySection noun="education" onAdd={openAdd} />
        : (
          <div className="space-y-4">
            {educations.map(edu => (
              <div key={edu.id} className="group space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{edu.institution}</p>
                    <p className="text-sm text-muted-foreground">
                      {edu.qualification}{edu.field ? ` · ${edu.field}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {edu.grade && <Badge variant="secondary" className="text-xs">{edu.grade}</Badge>}
                    <RowControls label={edu.institution} onEdit={() => openEdit(edu)} onDelete={() => handleDelete(edu.id)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {edu.startDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  {' – '}
                  {edu.endDate
                    ? edu.endDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                    : 'Present'}
                </p>
                <Separator className="mt-2" />
              </div>
            ))}
          </div>
        )
      }
      <EducationDialog open={open} onOpenChange={setOpen} editing={editing} onSave={handleSave} saving={saving} />
    </div>
  )
}

function EducationDialog({
  open, onOpenChange, editing, onSave, saving,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editing: EducationType | null
  onSave: (data: Parameters<typeof createEducation>[0]) => void
  saving: boolean
}) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const endDateStr = fd.get('endDate') as string
    onSave({
      institution: fd.get('institution') as string,
      qualification: fd.get('qualification') as string,
      field: (fd.get('field') as string) || undefined,
      startDate: new Date(fd.get('startDate') as string),
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      grade: (fd.get('grade') as string) || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Education' : 'Add Education'}</DialogTitle>
        </DialogHeader>
        <form key={editing?.id ?? 'new'} onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <Label htmlFor="edu-institution">Institution</Label>
              <Input id="edu-institution" name="institution" defaultValue={editing?.institution} required />
            </Field>
            <Field>
              <Label htmlFor="edu-qualification">Qualification</Label>
              <Input id="edu-qualification" name="qualification" placeholder="e.g. BSc Computer Science" defaultValue={editing?.qualification} required />
            </Field>
            <Field>
              <Label htmlFor="edu-field">Field of Study</Label>
              <Input id="edu-field" name="field" defaultValue={editing?.field ?? ''} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label htmlFor="edu-start">Start Date</Label>
                <Input id="edu-start" name="startDate" type="date" defaultValue={toDateInput(editing?.startDate)} required />
              </Field>
              <Field>
                <Label htmlFor="edu-end">End Date</Label>
                <Input id="edu-end" name="endDate" type="date" defaultValue={toDateInput(editing?.endDate)} />
              </Field>
            </div>
            <Field>
              <Label htmlFor="edu-grade">Grade</Label>
              <Input id="edu-grade" name="grade" placeholder="e.g. First Class, 3.8 GPA" defaultValue={editing?.grade ?? ''} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" variant="secondary" disabled={saving}>Cancel</Button>} />
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Certifications ────────────────────────────────────────────────────────────

function CertificationsSection({ initial }: { initial: CertType[] }) {
  const [certs, setCerts] = useState(initial)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CertType | null>(null)
  const [saving, setSaving] = useState(false)

  const sixMonthsFromNow = new Date()
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6)

  const openAdd = () => { setEditing(null); setOpen(true) }
  const openEdit = (c: CertType) => { setEditing(c); setOpen(true) }

  const handleDelete = async (id: string) => {
    const prev = certs
    setCerts(c => c.filter(c => c.id !== id))
    try { await deleteCertification(id) } catch { setCerts(prev) }
  }

  const handleSave = async (data: Parameters<typeof createCertification>[0]) => {
    setSaving(true)
    try {
      if (editing) {
        const updated = await updateCertification(editing.id, data)
        setCerts(c => c.map(x => x.id === editing.id ? updated as unknown as CertType : x))
      } else {
        const created = await createCertification(data)
        setCerts(c => [...c, created as unknown as CertType])
      }
      setOpen(false)
    } catch { } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeader title="Certifications" onAdd={openAdd} />
      {certs.length === 0
        ? <EmptySection noun="certifications" onAdd={openAdd} />
        : (
          <div className="space-y-1">
            {certs.map(cert => {
              const expiringSoon = cert.expiryDate && cert.expiryDate < sixMonthsFromNow
              return (
                <div key={cert.id} className="group flex items-start justify-between gap-2 py-1.5 border-b border-border last:border-0">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-semibold truncate">{cert.name}</p>
                    {cert.issuer && <p className="text-xs text-muted-foreground">{cert.issuer}</p>}
                    <p className="text-xs text-muted-foreground">
                      {cert.issueDate && `Issued ${cert.issueDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`}
                      {cert.expiryDate && ` · Expires ${cert.expiryDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {expiringSoon && <Badge variant="warning" className="text-xs">Expires soon</Badge>}
                    <RowControls label={cert.name} onEdit={() => openEdit(cert)} onDelete={() => handleDelete(cert.id)} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
      <CertificationDialog open={open} onOpenChange={setOpen} editing={editing} onSave={handleSave} saving={saving} />
    </div>
  )
}

function CertificationDialog({
  open, onOpenChange, editing, onSave, saving,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editing: CertType | null
  onSave: (data: Parameters<typeof createCertification>[0]) => void
  saving: boolean
}) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const expiryStr = fd.get('expiryDate') as string
    onSave({
      name: fd.get('name') as string,
      issuer: fd.get('issuer') as string,
      issueDate: new Date(fd.get('issueDate') as string),
      expiryDate: expiryStr ? new Date(expiryStr) : undefined,
      credentialUrl: (fd.get('credentialUrl') as string) || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Certification' : 'Add Certification'}</DialogTitle>
        </DialogHeader>
        <form key={editing?.id ?? 'new'} onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <Label htmlFor="cert-name">Certification Name</Label>
              <Input id="cert-name" name="name" defaultValue={editing?.name} required />
            </Field>
            <Field>
              <Label htmlFor="cert-issuer">Issuer</Label>
              <Input id="cert-issuer" name="issuer" defaultValue={editing?.issuer ?? undefined} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label htmlFor="cert-issued">Issue Date</Label>
                <Input id="cert-issued" name="issueDate" type="date" defaultValue={toDateInput(editing?.issueDate)} required />
              </Field>
              <Field>
                <Label htmlFor="cert-expiry">Expiry Date</Label>
                <Input id="cert-expiry" name="expiryDate" type="date" defaultValue={toDateInput(editing?.expiryDate)} />
              </Field>
            </div>
            <Field>
              <Label htmlFor="cert-url">Credential URL</Label>
              <Input id="cert-url" name="credentialUrl" type="url" placeholder="https://..." defaultValue={editing?.credentialUrl ?? ''} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" variant="secondary" disabled={saving}>Cancel</Button>} />
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
