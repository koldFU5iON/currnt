'use client'

import { useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { useBlockEditTrigger } from '../cv-block'
import type { CVSection, CertificationData } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'certification'; data: CertificationData }
  onUpdate: (section: CVSection) => void
}

export function CertificationBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data)
  const { name, issuer, date, url } = section.data
  const editTrigger = useBlockEditTrigger()

  useEffect(() => {
    if (editTrigger > 0) setEditing(true)
  }, [editTrigger])

  function save() {
    onUpdate({ ...section, data: draft })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 border-b border-border pb-1">
        <h2 className="cv-section-heading">Certification</h2>
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
          <p className="cv-item-title">{name}</p>
          <p className="cv-meta">
            {[issuer, date].filter(Boolean).join(' · ')}
          </p>
          {/^https?:\/\//i.test(url ?? '') && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="cv-meta text-primary hover:underline"
            >
              {url}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
