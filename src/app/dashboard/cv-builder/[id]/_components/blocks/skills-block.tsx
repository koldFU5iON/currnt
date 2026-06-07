'use client'

import { useState } from 'react'
import { Check, X, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useBlockEditTrigger } from '../cv-block'
import type { CVSection } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'skills' }
  onUpdate: (section: CVSection) => void
  showHeading?: boolean
}

export function SkillsBlock({ section, onUpdate, showHeading = true }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data.items)
  const editTrigger = useBlockEditTrigger()

  const [seenTrigger, setSeenTrigger] = useState(editTrigger)
  if (seenTrigger !== editTrigger) {
    setSeenTrigger(editTrigger)
    if (editTrigger > 0) setEditing(true)
  }

  function save() {
    onUpdate({ ...section, data: { items: draft.filter(Boolean) } })
    setEditing(false)
  }

  return (
    <div>
      {showHeading && (
        <div className="mb-2 border-b border-border pb-1">
          <h2 className="cv-section-heading">Skills</h2>
        </div>
      )}
      {editing ? (
        <div className="space-y-2">
          {draft.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={item}
                onChange={e => setDraft(draft.map((d, j) => j === i ? e.target.value : d))}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => setDraft(draft.map((d, j) => j === i - 1 ? draft[i] : j === i ? draft[i - 1] : d))}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ChevronUp className="size-3" />
                </button>
                <button
                  type="button"
                  disabled={i === draft.length - 1}
                  onClick={() => setDraft(draft.map((d, j) => j === i + 1 ? draft[i] : j === i ? draft[i + 1] : d))}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ChevronDown className="size-3" />
                </button>
              </div>
              <button onClick={() => setDraft(draft.filter((_, j) => j !== i))} className="rounded p-1.5 text-muted-foreground hover:bg-muted">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <button onClick={() => setDraft([...draft, ''])} className="flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
            <Plus className="size-3" />Add
          </button>
          <div className="flex gap-2">
            <button onClick={save} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
              <Check className="size-3" />Save
            </button>
            <button onClick={() => { setDraft(section.data.items); setEditing(false) }} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
              <X className="size-3" />Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="cv-body">{section.data.items.join(' · ')}</p>
      )}
    </div>
  )
}
