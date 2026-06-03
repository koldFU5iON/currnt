'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import type { CVSection, EducationData } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'education'; data: EducationData }
  onUpdate: (section: CVSection) => void
}

export function EducationBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data)
  const { institution, qualification, field, duration, grade } = section.data

  function save() {
    onUpdate({ ...section, data: draft })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">Education</h2>
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
                ['Institution', 'institution', draft.institution, false],
                ['Qualification', 'qualification', draft.qualification, false],
                ['Field (optional)', 'field', draft.field ?? '', true],
                ['Duration', 'duration', draft.duration, false],
                ['Grade (optional)', 'grade', draft.grade ?? '', true],
              ] as const
            ).map(([label, key, value, optional]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{label}</label>
                <input
                  value={value}
                  onChange={e => {
                    const val = e.target.value
                    if (optional) {
                      setDraft({ ...draft, [key]: val || undefined })
                    } else {
                      setDraft({ ...draft, [key]: val })
                    }
                  }}
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
          <p className="text-sm font-semibold text-foreground">{institution}</p>
          <p className="text-sm text-muted-foreground">
            {qualification}
            {field ? ` · ${field}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            {duration}
            {grade ? ` · ${grade}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
