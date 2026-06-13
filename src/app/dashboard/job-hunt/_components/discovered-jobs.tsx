'use client'

import { useState } from 'react'
import { JobQueueRow } from './job-queue-row'
import type { DiscoveredJobWithWatch } from './job-queue-row'

type FilterTab = 'all' | 'company' | 'board' | 'scored'

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'company', label: 'Company' },
  { value: 'board',   label: 'Boards' },
  { value: 'scored',  label: 'Scored' },
]

type Props = {
  jobs: DiscoveredJobWithWatch[]
}

export function DiscoveredJobs({ jobs }: Props) {
  const [tab, setTab] = useState<FilterTab>('all')
  const [showIgnored, setShowIgnored] = useState(false)

  const visible = jobs.filter((j) => {
    if (!showIgnored && j.status === 'ignored') return false
    if (tab === 'company') return j.watch != null
    if (tab === 'board')   return j.boardSource != null
    if (tab === 'scored')  return j.fitLabel != null
    return true
  })

  const pendingCount = jobs.filter((j) => j.status === 'new' || j.status === 'scored').length

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold">Discovered Roles</h2>
          <p className="text-sm text-muted-foreground">
            {pendingCount > 0 ? `${pendingCount} waiting for review` : 'No roles pending review'}
          </p>
        </div>
        <button
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setShowIgnored((v) => !v)}
        >
          {showIgnored ? 'Hide ignored' : 'Show ignored'}
        </button>
      </div>

      <div className="flex gap-1 mb-3 border-b">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.value
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {tab === 'company'
              ? 'No company roles found yet. Scan a watched company to discover matching roles.'
              : tab === 'board'
              ? 'No board roles found yet. Enable a job board source and click Scan.'
              : 'No roles found yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((job) => (
            <JobQueueRow key={job.id} job={job} />
          ))}
        </div>
      )}
    </section>
  )
}
