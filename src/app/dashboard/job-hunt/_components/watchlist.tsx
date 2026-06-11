import type { CompanyWatch } from '@prisma/client'
import { AddCompanySheet } from './add-company-sheet'
import { CompanyWatchRow } from './company-watch-row'
import { SyncAllButton } from './sync-all-button'

export function Watchlist({ watches }: { watches: CompanyWatch[] }) {
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

      {watches.length > 0 && (
        <div className="space-y-2">
          {watches.map((w) => (
            <CompanyWatchRow key={w.id} watch={w} />
          ))}
        </div>
      )}
    </section>
  )
}
