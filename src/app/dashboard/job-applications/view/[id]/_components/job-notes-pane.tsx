'use client'

import { useState, useRef, useTransition, useCallback } from 'react'
import { Pencil, Eye, Check } from 'lucide-react'
import { MarkdownProse } from '@/components/ui/markdown-prose'
import { updateJobNotes } from '@/modules/jobs/mutations'
import { cn } from '@/lib/utils'

interface Props {
  jobId: string
  notes: string | null | undefined
  notesIncludeInFit: boolean
}

export function JobNotesPane({ jobId, notes, notesIncludeInFit }: Props) {
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const [draft, setDraft] = useState(notes ?? '')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const save = useCallback(() => {
    startTransition(async () => {
      await updateJobNotes(jobId, draft, notesIncludeInFit)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    })
  }, [jobId, draft, notesIncludeInFit])

  const enterEdit = () => {
    setMode('edit')
    // Focus textarea on next tick after render
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const exitEdit = () => {
    setMode('preview')
    save()
  }

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Sticky header */}
      <div className="flex shrink-0 items-center justify-between border-b bg-background px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notes
        </h2>
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="text-[10px] text-muted-foreground">Saving…</span>
          )}
          {saved && !isPending && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Check className="size-3" /> Saved
            </span>
          )}
          <button
            onClick={mode === 'preview' ? enterEdit : exitEdit}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={mode === 'preview' ? 'Edit notes' : 'Preview notes'}
          >
            {mode === 'preview' ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={exitEdit}
            placeholder="Add notes in Markdown…"
            className={cn(
              'h-full min-h-full w-full resize-none bg-background p-4 text-sm leading-relaxed',
              'focus:outline-none',
            )}
          />
        ) : draft.trim() ? (
          <div
            className="cursor-text px-4 py-4"
            onClick={enterEdit}
            title="Click to edit"
          >
            <MarkdownProse content={draft} />
          </div>
        ) : (
          <div
            className="cursor-text px-4 py-4"
            onClick={enterEdit}
            title="Click to add notes"
          >
            <p className="text-sm text-muted-foreground">
              No notes yet. Click to add.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
