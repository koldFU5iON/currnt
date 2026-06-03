'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import type { CVSection, CertificationData } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'certification'; data: CertificationData }
  onUpdate: (section: CVSection) => void
}

export function CertificationBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data)
  const { name, issuer, date, url } = section.data

  function save() {
    onUpdate({ ...section, data: draft })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">
          Certification
        </h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 print:hidden"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['Name', 'name', draft.name, false],
                ['Issuer (optional)', 'issuer', draft.issuer ?? '', true],
                ['Date (optional)', 'date', draft.date ?? '', true],
                ['URL (optional)', 'url', draft.url ?? '', true],
              ] as const
            ).map(([label, key, value, optional]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{label}</label>
                <input
                  value={value}
                  onChange={e =>
                    setDraft({
                      ...draft,
                      [key]: optional ? e.target.value || undefined : e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
            >
              <Check className="size-3" />
              Save
            </button>
            <button
              onClick={() => {
                setDraft(section.data)
                setEditing(false)
              }}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <X className="size-3" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">
            {[issuer, date].filter(Boolean).join(' · ')}
          </p>
          {/^https?:\/\//i.test(url ?? '') && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              {url}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
