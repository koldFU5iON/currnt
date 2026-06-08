// src/app/dashboard/interview-prep/[id]/_components/block-editor.tsx
'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Block } from '@/modules/interview-prep/schema'
import {
  updateBlock, deleteBlock, moveBlockUp, moveBlockDown, convertAiBlockToText,
} from '@/modules/interview-prep/actions'

type Props = {
  noteId: string
  block: Block
  isFirst: boolean
  isLast: boolean
}

export function BlockEditor({ noteId, block, isFirst, isLast }: Props) {
  const [title, setTitle] = useState(block.title)
  const [content, setContent] = useState(block.content)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isAI = block.type === 'ai-analysis'
  const isQA = block.type === 'qa-bank'
  const isReadOnly = isAI || isQA

  function scheduleSave(updates: { title?: string; content?: string }) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      startTransition(async () => {
        await updateBlock(noteId, block.id, updates)
      })
    }, 800)
  }

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  function handleTitleChange(val: string) {
    setTitle(val)
    scheduleSave({ title: val })
  }

  function handleContentChange(val: string) {
    setContent(val)
    scheduleSave({ content: val })
  }

  function handleMoveUp() {
    startTransition(async () => { await moveBlockUp(noteId, block.id) })
  }

  function handleMoveDown() {
    startTransition(async () => { await moveBlockDown(noteId, block.id) })
  }

  function handleDelete() {
    setMenuOpen(false)
    startTransition(async () => { await deleteBlock(noteId, block.id) })
  }

  function handleConvert() {
    setMenuOpen(false)
    startTransition(async () => { await convertAiBlockToText(noteId, block.id) })
  }

  return (
    <div className={cn(
      'relative rounded-lg border overflow-hidden',
      isAI && 'border-l-2 border-l-primary',
      isPending && 'opacity-60',
    )}>
      {/* Block header */}
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
        <input
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          className="flex-1 bg-transparent text-xs font-medium outline-none placeholder:text-muted-foreground"
          placeholder="Block title"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={handleMoveUp}
            disabled={isFirst || isPending}
            className="rounded p-0.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-30"
            title="Move up"
          >↑</button>
          <button
            onClick={handleMoveDown}
            disabled={isLast || isPending}
            className="rounded p-0.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-30"
            title="Move down"
          >↓</button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="rounded p-0.5 text-xs text-muted-foreground hover:bg-accent"
              title="Block options"
            >⋯</button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 rounded-md border bg-popover py-1 shadow-md">
                {isAI && (
                  <button
                    onClick={handleConvert}
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    Convert to text block
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="block w-full px-3 py-1.5 text-left text-xs text-destructive hover:bg-accent"
                >
                  Delete block
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Block content */}
      <textarea
        value={content}
        onChange={e => handleContentChange(e.target.value)}
        readOnly={isReadOnly}
        rows={Math.max(4, content.split('\n').length + 1)}
        className={cn(
          'w-full resize-none bg-transparent p-3 font-mono text-sm outline-none',
          isReadOnly && 'cursor-default text-muted-foreground',
        )}
        placeholder={isReadOnly ? '' : 'Write your notes here (Markdown)…'}
      />
    </div>
  )
}
