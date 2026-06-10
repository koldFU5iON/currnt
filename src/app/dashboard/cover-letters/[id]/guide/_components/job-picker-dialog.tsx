'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Briefcase, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { JobPickerOption } from '@/modules/jobs/queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobs: JobPickerOption[]
  onSelect: (jobId: string) => void
  isPending: boolean
}

export function JobPickerDialog({ open, onOpenChange, jobs, onSelect, isPending }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter(
      j =>
        j.title.toLowerCase().includes(q) ||
        (j.company ?? '').toLowerCase().includes(q),
    )
  }, [jobs, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Which job is this letter for?</DialogTitle>
          <DialogDescription>
            The AI guide tailors your letter to a specific role. Pick a job so it has the
            title, company, and job description to write from.
          </DialogDescription>
        </DialogHeader>

        {jobs.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            <p>You don&apos;t have any active jobs yet.</p>
            <Link
              href="/dashboard/job-applications"
              className="mt-2 inline-block font-semibold text-primary hover:underline"
            >
              Add a job →
            </Link>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by title or company…"
                className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="max-h-72 overflow-y-auto -mx-1 px-1">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No jobs match “{query}”.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {filtered.map(job => (
                    <li key={job.id}>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onSelect(job.id)}
                        className="flex w-full items-start gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50 disabled:opacity-50"
                      >
                        <Briefcase className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{job.title}</span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {[job.company, job.status].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
