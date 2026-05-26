'use client'

import { useState, useTransition } from "react"
import { Flame, Loader2, Sparkles } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import type { JobFit as JobFitType } from "@/app/types/job-application"
import { assessJobFit } from "@/modules/jobs/job-fit"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type JobFitProps = {
  jobId?: string                  // required to trigger an assessment
  jobFit: JobFitType | null
  canAssess?: boolean             // false when the row has no description
}

// Maps the bucket label to a visual treatment for the flame. Higher fit gets
// warmer color; "poor" is muted so we don't shout about bad matches.
const LABEL_STYLES: Record<JobFitType['label'], string> = {
  poor:      'fill-muted-foreground/40 text-muted-foreground/40',
  ok:        'fill-amber-200 text-amber-300',
  stretch:   'fill-amber-400 text-amber-500',
  good:      'fill-orange-500 text-orange-600',
  excellent: 'fill-red-500 text-red-600',
}

export function JobFit({ jobId, jobFit, canAssess = true }: JobFitProps) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  // No jobId means display-only context (e.g. read-only views). Show the
  // existing flame if assessed, otherwise nothing.
  if (!jobId) {
    if (!jobFit) return <div className="size-4" />
    return <FitFlame fit={jobFit} />
  }

  function handleAssess() {
    if (!jobId || isPending) return
    startTransition(async () => {
      const result = await assessJobFit(jobId)
      if (result.ok) {
        toast.success(`Fit: ${result.fit.label} (${result.fit.rating}/10)`)
        setOpen(true)
      } else {
        // not_configured → directs to settings; everything else just surfaces the message
        toast.error(result.message, {
          action: result.error === 'not_configured'
            ? { label: 'Set up', onClick: () => { window.location.href = '/dashboard/settings/llm' } }
            : undefined,
        })
      }
    })
  }

  if (isPending) {
    return (
      <div className="flex size-6 items-center justify-center" aria-live="polite" aria-label="Assessing fit">
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!jobFit) {
    return (
      <button
        type="button"
        onClick={handleAssess}
        disabled={!canAssess}
        title={canAssess ? 'Assess fit' : 'Add a job description first'}
        aria-label={canAssess ? 'Assess job fit with AI' : 'Job description required to assess fit'}
        className={cn(
          "flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors",
          canAssess
            ? "hover:bg-muted hover:text-foreground cursor-pointer"
            : "cursor-not-allowed opacity-50",
        )}
      >
        <Sparkles size={14} />
      </button>
    )
  }

  // Assessed — flame icon opens popover with score + justification, plus a
  // re-run option so the user isn't locked into a stale assessment.
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Fit: ${jobFit.label}, ${jobFit.rating} out of 10`}
        className="flex size-6 items-center justify-center rounded-md hover:bg-muted/50"
      >
        <FitFlame fit={jobFit} />
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold capitalize">{jobFit.label}</p>
          <span className="font-mono text-xs text-muted-foreground">{jobFit.rating}/10</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{jobFit.justification}</p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleAssess() }}
          className="mt-3 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Sparkles size={11} />
          Re-assess
        </button>
      </PopoverContent>
    </Popover>
  )
}

function FitFlame({ fit }: { fit: JobFitType }) {
  return <Flame size={14} className={LABEL_STYLES[fit.label] ?? LABEL_STYLES.ok} />
}
