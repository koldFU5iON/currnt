'use client'

import { useState } from 'react'
import type { CompanyWatch } from '@prisma/client'
import { JobQueueRow } from './job-queue-row'
import type { DiscoveredJobWithWatch as BaseJob } from './job-queue-row'

type DiscoveredJobWithWatch = BaseJob & { watchId: string }

type Props = {
  jobs: DiscoveredJobWithWatch[]
  watches: CompanyWatch[]
}

export function DiscoveredJobs({ jobs, watches }: Props) {
  const [showIgnored, setShowIgnored] = useState(false)
  const [filterWatchId, setFilterWatchId] = useState<string>('all')

  const visible = jobs.filter((j) => {
    if (!showIgnored && j.status === 'ignored') return false
    if (filterWatchId !== 'all' && j.watchId !== filterWatchId) return false
    return true
  })

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold">Discovered Roles</h2>
          <p className="text-sm text-muted-foreground">
            {jobs.filter((j) => j.status === 'new' || j.status === 'scored').length} roles waiting for review
          </p>
        </div>
        <div className="flex items-center gap-2">
          {watches.length > 1 && (
            <select
              className="text-sm border rounded-md px-2 py-1 bg-background"
              value={filterWatchId}
              onChange={(e) => setFilterWatchId(e.target.value)}
            >
              <option value="all">All companies</option>
              {watches.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          )}
          <button
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setShowIgnored((v) => !v)}
          >
            {showIgnored ? 'Hide ignored' : 'Show ignored'}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No roles found yet. Scan a watched company to discover matching roles.
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
