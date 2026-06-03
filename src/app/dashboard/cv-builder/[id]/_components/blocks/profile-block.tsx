'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { CVSection } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'profile' }
  onUpdate: (section: CVSection) => void
}

export function ProfileBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data.content)

  function save() {
    onUpdate({ ...section, data: { content: draft } })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">
          Professional Profile
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
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">Markdown supported: **bold**, _italic_</p>
          <div className="flex gap-2">
            <button onClick={save} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
              <Check className="size-3" />Save
            </button>
            <button
              onClick={() => { setDraft(section.data.content); setEditing(false) }}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <X className="size-3" />Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <ReactMarkdown>{section.data.content}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
