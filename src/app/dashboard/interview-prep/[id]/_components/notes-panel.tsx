// src/app/dashboard/interview-prep/[id]/_components/notes-panel.tsx
'use client'

import { useRef, useTransition } from 'react'
import { cn } from '@/lib/utils'
import type { PrepNoteRow } from '@/modules/interview-prep/queries'
import type { Block } from '@/modules/interview-prep/schema'
import { createNote, addTextBlock } from '@/modules/interview-prep/actions'
import { BlockIndex } from './block-index'
import { BlockEditor } from './block-editor'

type Props = {
  sessionId: string
  notes: PrepNoteRow[]
  activeNoteId: string
  onNoteChange: (id: string) => void
  activeNote: PrepNoteRow | undefined
}

export function NotesPanel({ sessionId, notes, activeNoteId, onNoteChange, activeNote }: Props) {
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [isPending, startTransition] = useTransition()

  const sorted = activeNote
    ? [...activeNote.sections].sort((a: Block, b: Block) => a.order - b.order)
    : []

  function scrollToBlock(blockId: string) {
    blockRefs.current[blockId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleAddNote() {
    startTransition(async () => {
      await createNote(sessionId, 'New doc')
    })
  }

  function handleAddTextBlock() {
    if (!activeNote) return
    startTransition(async () => { await addTextBlock(activeNote.id) })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-r">
      {/* Note doc switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b bg-muted/30 px-3 py-2">
        {notes.map(note => (
          <button
            key={note.id}
            onClick={() => onNoteChange(note.id)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              note.id === activeNoteId
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-accent',
            )}
          >
            {note.title}
          </button>
        ))}
        <button
          onClick={handleAddNote}
          disabled={isPending}
          className="shrink-0 rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          + New doc
        </button>
      </div>

      {/* Index + blocks */}
      <div className="flex flex-1 overflow-hidden">
        <BlockIndex blocks={sorted} onScrollTo={scrollToBlock} />

        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-1 flex-col gap-3 p-4">
            {sorted.map(block => (
              <div key={block.id} ref={el => { blockRefs.current[block.id] = el }}>
                <BlockEditor
                  noteId={activeNote!.id}
                  block={block}
                  isFirst={block.order === 0}
                  isLast={block.order === sorted.length - 1}
                />
              </div>
            ))}
          </div>

          {/* Add block footer */}
          <div className="flex gap-2 border-t bg-muted/30 p-3">
            <button
              onClick={handleAddTextBlock}
              disabled={isPending || !activeNote}
              className="rounded border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              + Text block
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
