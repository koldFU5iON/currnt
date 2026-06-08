// src/app/dashboard/interview-prep/[id]/_components/block-index.tsx
'use client'

import { cn } from '@/lib/utils'
import type { Block } from '@/modules/interview-prep/schema'

type Props = {
  blocks: Block[]
  onScrollTo: (blockId: string) => void
}

export function BlockIndex({ blocks, onScrollTo }: Props) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order)

  return (
    <div className="flex w-36 shrink-0 flex-col gap-0.5 overflow-y-auto border-r bg-muted/30 p-2">
      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Index
      </p>
      {sorted.map(block => (
        <button
          key={block.id}
          onClick={() => onScrollTo(block.id)}
          className={cn(
            'rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent',
            (block.type === 'ai-analysis' || block.type === 'qa-bank') && 'text-primary',
          )}
        >
          {block.type === 'ai-analysis' || block.type === 'qa-bank' ? '✦ ' : ''}
          {block.title || 'Untitled'}
        </button>
      ))}
      <p className="mt-auto border-t pt-2 text-[10px] text-muted-foreground px-2">
        {sorted.length} {sorted.length === 1 ? 'block' : 'blocks'}
      </p>
    </div>
  )
}
