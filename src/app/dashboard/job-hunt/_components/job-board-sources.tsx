'use client'

import { useState } from 'react'
import type { JobBoardSource, ManualJobBoard } from '@prisma/client'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BoardSourceRow } from './board-source-row'
import { ManualBoardsSection } from './manual-boards-section'

const FREE_PROVIDERS = ['remotive', 'remoteok', 'adzuna'] as const
const PAID_PROVIDERS = ['jsearch'] as const

type Props = {
  sources: JobBoardSource[]
  availableProviders: Set<string>
  manualBoards: ManualJobBoard[]
}

export function JobBoardSources({ sources, availableProviders, manualBoards }: Props) {
  const [open, setOpen] = useState(true)
  const byProvider = Object.fromEntries(sources.map((s) => [s.provider, s]))
  const active = sources.filter(s => !s.lastScanError).length
  const failed = sources.length - active

  return (
    <section>
      <div className="w-full flex items-center gap-2 mb-3">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          aria-expanded={open}
          aria-controls="job-boards-body"
        >
          <h2 className="text-sm font-semibold">Job Board Sources</h2>
          <div className="flex items-center gap-1 ml-1">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
              {sources.length}
            </span>
            {active > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                ✓ {active}
              </span>
            )}
            {failed > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">
                ✗ {failed}
              </span>
            )}
            <ChevronDown className={cn("size-3.5 text-muted-foreground/50 transition-transform duration-200 shrink-0 ml-1", !open && "rotate-90")} />
          </div>
        </button>
      </div>

      {open && (
        <div id="job-boards-body" className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1">Free</p>
          {FREE_PROVIDERS.map((p) => {
            const source = byProvider[p]
            if (!source) return null
            return <BoardSourceRow key={p} source={source} isAdapterAvailable={availableProviders.has(p)} />
          })}
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 pt-2">
            Paid — bring your own key
          </p>
          {PAID_PROVIDERS.map((p) => {
            const source = byProvider[p]
            if (!source) return null
            return <BoardSourceRow key={p} source={source} isAdapterAvailable={availableProviders.has(p)} />
          })}
          <div className="pt-2">
            <ManualBoardsSection boards={manualBoards} />
          </div>
        </div>
      )}
    </section>
  )
}
