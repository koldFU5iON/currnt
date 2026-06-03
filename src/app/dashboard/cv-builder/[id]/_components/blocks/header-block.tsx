'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import type { CVSection, HeaderData } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'header'; data: HeaderData }
  onUpdate: (section: CVSection) => void
}

export function HeaderBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data)

  function save() {
    onUpdate({ ...section, data: draft })
    setEditing(false)
  }

  function cancel() {
    setDraft(section.data)
    setEditing(false)
  }

  const { name, headline, subHeadline, contact } = section.data

  if (!editing) {
    return (
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{name}</h1>
            <p className="text-base text-muted-foreground">{headline}</p>
            {subHeadline && (
              <p className="text-sm font-medium text-muted-foreground">{subHeadline}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {[contact.email, contact.phone, contact.linkedin, contact.website]
                .filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="ml-4 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 print:hidden"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {([
          ['Name', 'name', draft.name],
          ['Headline', 'headline', draft.headline],
        ] as const).map(([label, field, value]) => (
          <div key={field} className="space-y-1">
            <label className="text-xs text-muted-foreground">{label}</label>
            <input
              value={value}
              onChange={e => setDraft({ ...draft, [field]: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sub-headline (optional)</label>
          <input
            value={draft.subHeadline ?? ''}
            onChange={e => setDraft({ ...draft, subHeadline: e.target.value || undefined })}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {([
          ['Email', 'email'],
          ['Phone', 'phone'],
          ['LinkedIn', 'linkedin'],
          ['Website', 'website'],
        ] as const).map(([label, field]) => (
          <div key={field} className="space-y-1">
            <label className="text-xs text-muted-foreground">{label}</label>
            <input
              value={draft.contact[field] ?? ''}
              onChange={e => setDraft({ ...draft, contact: { ...draft.contact, [field]: e.target.value || undefined } })}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
          <Check className="size-3" />Save
        </button>
        <button onClick={cancel} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
          <X className="size-3" />Cancel
        </button>
      </div>
    </div>
  )
}
