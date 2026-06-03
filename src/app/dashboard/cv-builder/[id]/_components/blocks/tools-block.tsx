'use client'

import { useState } from 'react'
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react'
import type { CVSection } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'tools' }
  onUpdate: (section: CVSection) => void
}

export function ToolsBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data.items)

  function save() {
    onUpdate({ ...section, data: { items: draft.filter(Boolean) } })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">Tools</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 print:hidden">
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {draft.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={item}
                onChange={e => setDraft(draft.map((d, j) => j === i ? e.target.value : d))}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
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
        <p className="text-sm text-muted-foreground">{section.data.items.join(' · ')}</p>
      )}
    </div>
  )
}
