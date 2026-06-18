'use client'

import { useState, useMemo } from 'react'
import type { CompanyWatch } from '@prisma/client'
import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AddCompanySheet } from './add-company-sheet'
import { CompanyWatchRow } from './company-watch-row'

type Filter = 'all' | 'working' | 'failed'

const PAGE_SIZE = 15

function isWorking(w: CompanyWatch) {
  return w.status === 'active' && !w.lastScanError
}
function isFailed(w: CompanyWatch) {
  return w.status !== 'active' || !!w.lastScanError
}

export function Watchlist({
  watches,
  defaultLocations = [],
  defaultRemote = true,
}: {
  watches: CompanyWatch[]
  defaultLocations?: string[]
  defaultRemote?: boolean
}) {
  const [open, setOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)

  const working = watches.filter(isWorking).length
  const failed = watches.length - working

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return watches.filter((w) => {
      if (q && !w.name.toLowerCase().includes(q)) return false
      if (filter === 'working') return isWorking(w)
      if (filter === 'failed') return isFailed(w)
      return true
    })
  }, [watches, search, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const healthy = filter === 'all' ? paged.filter(isWorking) : []
  const needsAttention = filter === 'all' ? paged.filter(isFailed) : paged

  function handleFilterChange(f: Filter) {
    setFilter(f)
    setPage(1)
  }
  function handleSearch(v: string) {
    setSearch(v)
    setPage(1)
  }

  return (
    <section>
      <div className="w-full flex items-center gap-2 mb-3">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          aria-expanded={open}
          aria-controls="watchlist-body"
        >
          <h2 className="text-sm font-semibold">Watched Companies</h2>
          <div className="flex items-center gap-1 ml-1">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
              {watches.length}
            </span>
            {working > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                ✓ {working}
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
        <AddCompanySheet defaultLocations={defaultLocations} defaultRemote={defaultRemote} />
      </div>

      {open && (
        <div id="watchlist-body">
          {watches.length > 0 && (
            <div className="mb-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search companies…"
                  className="h-7 pl-6 text-xs"
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'working', 'failed'] as Filter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => handleFilterChange(f)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors capitalize ${
                      filter === f
                        ? 'bg-foreground text-background border-foreground'
                        : 'text-muted-foreground border-border hover:border-foreground/40'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && watches.length > 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">No companies match this filter</p>
          )}

          {filter === 'all' ? (
            <>
              {healthy.length > 0 && (
                <div className="space-y-2">
                  {healthy.map((w) => <CompanyWatchRow key={w.id} watch={w} />)}
                </div>
              )}
              {needsAttention.length > 0 && (
                <div className={healthy.length > 0 ? 'mt-4' : undefined}>
                  {healthy.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground mb-2">Needs attention</p>
                  )}
                  <div className="space-y-2">
                    {needsAttention.map((w) => <CompanyWatchRow key={w.id} watch={w} />)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              {paged.map((w) => <CompanyWatchRow key={w.id} watch={w} />)}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                <ChevronLeft className="size-3" />
              </Button>
              <span className="text-[10px] text-muted-foreground">{safePage} / {totalPages}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >
                <ChevronRight className="size-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
