'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type Props = {
  initialContent: string
  onSave: (content: string) => Promise<unknown>
  onSaveStateChange?: (state: SaveState) => void
  placeholder?: string
  className?: string
}

export function NoteEditor({
  initialContent,
  onSave,
  onSaveStateChange,
  placeholder = 'Click to start writing…',
  className,
}: Props) {
  const [content, setContent] = useState(initialContent)
  const [isEditing, setIsEditing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mountedRef = useRef(true)
  const viewRef = useRef<HTMLDivElement>(null)
  const latestContent = useRef(content)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestSave = useRef<(value: string) => Promise<void>>(async () => {})

  const save = useCallback(
    async (value: string) => {
      onSaveStateChange?.('saving')
      try {
        await onSave(value)
        if (mountedRef.current) onSaveStateChange?.('saved')
      } catch {
        if (mountedRef.current) onSaveStateChange?.('error')
      }
    },
    [onSave, onSaveStateChange],
  )

  useEffect(() => {
    latestContent.current = content
  }, [content])

  useEffect(() => {
    latestSave.current = save
  }, [save])

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
        void latestSave.current(latestContent.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus()
  }, [isEditing])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setContent(value)
    onSaveStateChange?.('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      void save(value)
    }, 1500)
  }

  function handleBlur() {
    setIsEditing(false)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      void save(content)
    }
    setTimeout(() => viewRef.current?.focus(), 0)
  }

  return (
    <div className={cn('flex-1 overflow-hidden', className)}>
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onBlur={handleBlur}
          className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/40"
          placeholder={placeholder}
        />
      ) : (
        <div
          ref={viewRef}
          role="button"
          tabIndex={0}
          onClick={() => setIsEditing(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsEditing(true)
            }
          }}
          className="h-full cursor-text overflow-y-auto p-4"
          aria-label="Edit note"
        >
          {content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground/50">{placeholder}</p>
          )}
        </div>
      )}
    </div>
  )
}
