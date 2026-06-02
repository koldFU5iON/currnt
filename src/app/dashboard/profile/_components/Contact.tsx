'use client'

import { useState } from "react"
import { H } from "@/app/components/style/Style"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertTriangleIcon, Check, Globe, Link2, Mail, MapPin, Pencil, Phone, User, X } from "lucide-react"
import { updateContactField, type ContactField } from "@/modules/profile/actions"

type ContactBlockProps = {
  name: string
  phone?: string
  email?: string
  site?: string
  profile?: string
  location?: string
}

type EditableFieldProps = {
  icon: React.ReactNode
  field: ContactField
  value?: string
  label: string
}

function EditableField({ icon, field, value, label }: EditableFieldProps) {
  const [editing, setEditing] = useState(false)
  const [current, setCurrent] = useState(value)
  const [draft, setDraft] = useState(value ?? '')
  const [error, setError] = useState(false)

  const handleSave = async () => {
    setEditing(false)
    const prev = current
    setCurrent(draft.trim() || undefined)
    try {
      await updateContactField(field, draft)
    } catch {
      setCurrent(prev)
      setError(true)
      setTimeout(() => setError(false), 3000)
    }
  }

  const handleCancel = () => {
    setDraft(current ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-1 py-1">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <Input
          className="h-7 text-sm py-0"
          value={draft}
          placeholder={label}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') handleCancel()
          }}
        />
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleSave} aria-label="Save">
          <Check size={13} />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleCancel} aria-label="Cancel">
          <X size={13} />
        </Button>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className="group flex items-center gap-2 px-1 py-1.5 rounded cursor-pointer hover:bg-accent/60 transition-colors"
      onClick={() => setEditing(true)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true) } }}
      aria-label={`Edit ${label}`}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      {error
        ? <span className="text-xs text-destructive">Failed to save</span>
        : current
          ? <span className="text-sm">{current}</span>
          : <AlertTriangleIcon size={14} className="text-amber-500" aria-label={`${label} not set`} />
      }
      <Pencil size={11} className="ml-auto opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
    </div>
  )
}

export function ContactBlock({ contact }: { contact: ContactBlockProps }) {
  return (
    <div className="ml-2 mt-2 space-y-0.5">
      <EditableField icon={<User size={14} />} field="name" value={contact.name} label="Name" />
      <EditableField icon={<Mail size={14} />} field="email" value={contact.email} label="Email" />
      <EditableField icon={<Phone size={14} />} field="phone" value={contact.phone} label="Phone" />
      <EditableField icon={<Link2 size={14} />} field="linkedIn" value={contact.profile} label="LinkedIn" />
      <EditableField icon={<Globe size={14} />} field="website" value={contact.site} label="Website" />
      <EditableField icon={<MapPin size={14} />} field="location" value={contact.location} label="Location" />
    </div>
  )
}
