'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { type DuplicateMatch } from '@/modules/jobs/dedup-internal'

export function DuplicateWarning({ matches }: { matches: DuplicateMatch[] }) {
  if (matches.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm dark:border-amber-700/40 dark:bg-amber-950/30"
    >
      <div className="flex gap-2">
        <AlertTriangle
          size={16}
          className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-1.5">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            {matches.length === 1
              ? 'Possible duplicate of an existing job'
              : `${matches.length} possible duplicates`}
          </p>
          <ul className="space-y-0.5">
            {matches.map(m => (
              <li key={m.id} className="truncate">
                <Link
                  href={`/dashboard/job-applications/view/${m.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-900 underline-offset-2 hover:underline dark:text-amber-100"
                >
                  {m.title}
                  <span className="font-normal text-amber-800/80 dark:text-amber-200/80">
                    {' '}at {m.company}
                  </span>
                </Link>
                <span className="ml-1 text-xs text-amber-800/70 dark:text-amber-200/70">
                  ({m.archivedAt ? 'archived' : m.status})
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
