'use client'

import { useState } from 'react'
import { Check, X, Plus, Trash2 } from 'lucide-react'
import { useBlockEditTrigger } from '../cv-block'
import { MarkdownProse } from '@/components/ui/markdown-prose'
import type { CVSection } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'custom' }
  onUpdate: (section: CVSection) => void
  showHeading?: boolean
}

export function CustomBlock({ section, onUpdate, showHeading = true }: Props) {
  const [editing, setEditing] = useState(false)
  const [draftHeading, setDraftHeading] = useState(section.data.heading)
  const [draftContent, setDraftContent] = useState(section.data.content ?? '')
  const [draftItems, setDraftItems] = useState(section.data.items ?? [])
  const editTrigger = useBlockEditTrigger()

  const [seenTrigger, setSeenTrigger] = useState(editTrigger)
  if (seenTrigger !== editTrigger) {
    setSeenTrigger(editTrigger)
    if (editTrigger > 0) setEditing(true)
  }

  function save() {
    onUpdate({
      ...section,
      data: {
        ...section.data,
        heading: draftHeading,
        content: section.data.subtype === 'text' ? draftContent : null,
        items: section.data.subtype === 'list' ? draftItems.filter(Boolean) : null,
      },
    })
    setEditing(false)
  }

  function cancel() {
    setDraftHeading(section.data.heading)
    setDraftContent(section.data.content ?? '')
    setDraftItems(section.data.items ?? [])
    setEditing(false)
  }

  if (!editing) {
    return (
      <div>
        {showHeading && (
          <div className="mb-2 border-b border-border pb-1">
            <h2 className="cv-section-heading">{section.data.heading}</h2>
          </div>
        )}
        {section.data.subtype === 'text' ? (
          <MarkdownProse content={section.data.content ?? ''} />
        ) : (
          <p className="cv-body">{(section.data.items ?? []).join(' · ')}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Section Heading</label>
        <input
          value={draftHeading}
          onChange={e => setDraftHeading(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {section.data.subtype === 'text' ? (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Content</label>
          <textarea
            value={draftContent}
            onChange={e => setDraftContent(e.target.value)}
            rows={6}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {draftItems.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={item}
                onChange={e => setDraftItems(draftItems.map((d, j) => j === i ? e.target.value : d))}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => setDraftItems(draftItems.filter((_, j) => j !== i))}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setDraftItems([...draftItems, ''])}
            className="flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <Plus className="size-3" />Add
          </button>
        </div>
      )}

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
