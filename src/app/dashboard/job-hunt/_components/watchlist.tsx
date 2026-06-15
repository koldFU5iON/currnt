import type { CompanyWatch } from '@prisma/client'
import { AddCompanySheet } from './add-company-sheet'
import { CompanyWatchRow } from './company-watch-row'
import { SyncAllButton } from './sync-all-button'

export function Watchlist({ watches }: { watches: CompanyWatch[] }) {
  const healthy = watches.filter(w => w.status === 'active' && !w.lastScanError)
  const needsAttention = watches.filter(w => w.status !== 'active' || !!w.lastScanError)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold">Watched Companies</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {watches.length === 0
              ? 'Add companies to start discovering roles'
              : `${watches.length} compan${watches.length === 1 ? 'y' : 'ies'} monitored`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {watches.length > 0 && <SyncAllButton />}
          <AddCompanySheet />
        </div>
      </div>

      {healthy.length > 0 && (
        <div className="space-y-2">
          {healthy.map((w) => (
            <CompanyWatchRow key={w.id} watch={w} />
          ))}
        </div>
      )}

      {needsAttention.length > 0 && (
        <div className={healthy.length > 0 ? 'mt-4' : undefined}>
          {healthy.length > 0 && (
            <p className="text-xs font-medium text-muted-foreground mb-2">Needs attention</p>
          )}
          <div className="space-y-2">
            {needsAttention.map((w) => (
              <CompanyWatchRow key={w.id} watch={w} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
