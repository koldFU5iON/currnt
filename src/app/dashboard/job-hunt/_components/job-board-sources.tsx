import type { JobBoardSource, ManualJobBoard } from '@prisma/client'
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
  const byProvider = Object.fromEntries(sources.map((s) => [s.provider, s]))

  return (
    <section>
      <h2 className="text-sm font-semibold mb-2">Job Board Sources</h2>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1">Free</p>
        {FREE_PROVIDERS.map((p) => {
          const source = byProvider[p]
          if (!source) return null
          return (
            <BoardSourceRow
              key={p}
              source={source}
              isAdapterAvailable={availableProviders.has(p)}
            />
          )
        })}

        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 pt-2">
          Paid — bring your own key
        </p>
        {PAID_PROVIDERS.map((p) => {
          const source = byProvider[p]
          if (!source) return null
          return (
            <BoardSourceRow
              key={p}
              source={source}
              isAdapterAvailable={availableProviders.has(p)}
            />
          )
        })}

        <div className="pt-2">
          <ManualBoardsSection boards={manualBoards} />
        </div>
      </div>
    </section>
  )
}
