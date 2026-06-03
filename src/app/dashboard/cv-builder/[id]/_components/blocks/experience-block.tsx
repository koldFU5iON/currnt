'use client'

import { useState } from 'react'
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { CVSection, ExperienceData } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'experience'; data: ExperienceData }
  onUpdate: (section: CVSection) => void
}

export function ExperienceBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data)
  const { company, titles, location, duration, description, outcomes } = section.data

  function save() {
    onUpdate({
      ...section,
      data: {
        ...draft,
        outcomes: draft.outcomes.filter(Boolean),
        titles: draft.titles.filter(Boolean),
      },
    })
    setEditing(false)
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
          <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">
            Professional Experience
          </h2>
          <button
            onClick={() => setEditing(true)}
            className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 print:hidden"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-foreground">{company}</p>
          <p className="text-xs text-muted-foreground">{duration}</p>
        </div>
        <p className="text-xs italic text-muted-foreground">{titles.join(' → ')}</p>
        <p className="mb-2 text-xs text-muted-foreground">{location}</p>
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <ReactMarkdown>{description}</ReactMarkdown>
        </div>
        <ul className="mt-2 space-y-1">
          {outcomes.map((o, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="shrink-0">→</span>
              <ReactMarkdown components={{ p: ({ children }) => <span>{children}</span> }}>
                {o}
              </ReactMarkdown>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="mb-2 border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">
          Professional Experience
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['Company', 'company', draft.company],
            ['Duration', 'duration', draft.duration],
            ['Location', 'location', draft.location],
          ] as const
        ).map(([label, field, value]) => (
          <div key={field} className="space-y-1">
            <label className="text-xs text-muted-foreground">{label}</label>
            <input
              value={value}
              onChange={e => setDraft({ ...draft, [field]: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          Titles (one per line — most recent first)
        </label>
        <textarea
          value={draft.titles.join('\n')}
          onChange={e => setDraft({ ...draft, titles: e.target.value.split('\n') })}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Description (Markdown supported)</label>
        <textarea
          value={draft.description}
          onChange={e => setDraft({ ...draft, description: e.target.value })}
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Outcomes</label>
        {draft.outcomes.map((o, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={o}
              onChange={e =>
                setDraft({
                  ...draft,
                  outcomes: draft.outcomes.map((x, j) => (j === i ? e.target.value : x)),
                })
              }
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={() =>
                setDraft({ ...draft, outcomes: draft.outcomes.filter((_, j) => j !== i) })
              }
              className="rounded p-1.5 text-muted-foreground hover:bg-muted"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={() => setDraft({ ...draft, outcomes: [...draft.outcomes, ''] })}
          className="flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          <Plus className="size-3" />
          Add outcome
        </button>
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
  )
}
