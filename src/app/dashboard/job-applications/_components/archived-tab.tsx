'use client'

import { useState, useTransition, useEffect } from 'react'
import { ArchiveRestore, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getArchivedJobsAction, restoreJobApplication } from '@/modules/jobs/mutations'
import { formatShortDate } from '@/lib/utils'
import { APPLICATION_STATUS_LABEL } from '@/app/types/job-application'
import type { Job } from '@/app/types/job-application'
import { Button } from '@/components/ui/button'

export function ArchivedTab() {
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    getArchivedJobsAction()
      .then(setJobs)
      .catch(() => {
        toast.error('Failed to load archived jobs')
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading || jobs === null) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
        <Loader2 className="size-4 animate-spin" />
        Loading archived jobs…
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Failed to load archived jobs.
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No archived jobs yet.
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/30 border border-border/30 rounded-md overflow-hidden mt-2">
      {jobs.map(job => (
        <ArchivedRow
          key={job.id}
          job={job}
          onRestored={(id) => setJobs(prev => (prev ?? []).filter(j => j.id !== id))}
        />
      ))}
    </div>
  )
}

function ArchivedRow({ job, onRestored }: { job: Job; onRestored: (id: string) => void }) {
  const [isPending, startTransition] = useTransition()

  function handleRestore() {
    startTransition(async () => {
      try {
        await restoreJobApplication(job.id)
        toast.success(`${job.title} restored`)
        onRestored(job.id)
      } catch {
        toast.error('Failed to restore job')
      }
    })
  }

  return (
    <div className="flex items-center gap-3 px-3 py-3 hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{job.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {job.company}
          {job.countries.length > 0 && ` · ${job.countries.join(', ')}`}
          <span className="ml-2 opacity-60">{APPLICATION_STATUS_LABEL[job.status]}</span>
          {job.archivedAt && (
            <span className="ml-2 opacity-50">Archived {formatShortDate(job.archivedAt)}</span>
          )}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleRestore}
        disabled={isPending}
        className="shrink-0 gap-1.5"
      >
        {isPending
          ? <Loader2 size={13} className="animate-spin" />
          : <ArchiveRestore size={13} />
        }
        Restore
      </Button>
    </div>
  )
}
