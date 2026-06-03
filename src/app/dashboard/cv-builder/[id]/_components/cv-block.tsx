'use client'

import { Eye, EyeOff, Copy } from 'lucide-react'
import type { CVSection } from '@/modules/cv/schema'

type Props = {
  section: CVSection
  onToggleVisibility: () => void
  onCopy: () => void
  children: React.ReactNode
}

export function CvBlock({ section, onToggleVisibility, onCopy, children }: Props) {
  if (!section.visible) {
    return (
      <div className="group flex items-center justify-between border-b border-border/30 px-6 py-2.5 opacity-40 last:border-b-0 print:hidden">
        <span className="text-xs italic text-muted-foreground capitalize">
          {section.type} — hidden
        </span>
        <button
          onClick={onToggleVisibility}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
        >
          <Eye className="size-3" />
          Show
        </button>
      </div>
    )
  }

  return (
    <div className="group relative border-b border-border/30 px-6 py-4 last:border-b-0 hover:bg-muted/20 print:hover:bg-transparent">
      {/* Controls */}
      <div className="absolute right-4 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 print:hidden">
        <button
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          title="Copy section"
        >
          <Copy className="size-3" />
        </button>
        <button
          onClick={onToggleVisibility}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          title="Hide section"
        >
          <EyeOff className="size-3" />
        </button>
      </div>

      {children}
    </div>
  )
}
