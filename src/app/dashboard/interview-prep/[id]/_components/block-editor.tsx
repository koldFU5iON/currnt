// src/app/dashboard/interview-prep/[id]/_components/block-editor.tsx
'use client'

import type { Block } from '@/modules/interview-prep/schema'

type Props = {
  noteId: string
  block: Block
  isFirst: boolean
  isLast: boolean
}

export function BlockEditor({ block }: Props) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      <p className="text-xs font-medium text-muted-foreground">{block.title || 'Untitled'}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{block.content}</p>
    </div>
  )
}
