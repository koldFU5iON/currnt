'use client'

import { Clock } from 'lucide-react'
import { ApplicationStatus, type ApplicationStatusType } from '@/app/types/job-application'
import { daysAgo, formatRelative, cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type Props = {
  lastUpdated: Date
  status: ApplicationStatusType
}

// Staleness only matters for submitted applications waiting on a response.
const STALE_STATUSES: ApplicationStatusType[] = [ApplicationStatus.Applied, ApplicationStatus.Interviewing]

export function FreshnessChip({ lastUpdated, status }: Props) {
  const days = daysAgo(lastUpdated) ?? 0
  const text = formatRelative(days)

  if (!STALE_STATUSES.includes(status) || days < 14) {
    return <span className="text-xs text-muted-foreground">{text}</span>
  }

  const isStale = days >= 30

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className={cn(
            'inline-flex cursor-default items-center gap-1 text-xs',
            isStale ? 'text-muted-foreground/50' : 'text-amber-500',
          )}>
            <Clock size={11} className="shrink-0" />
            {text}
          </span>
        }
      />
      <TooltipContent side="top">
        {isStale
          ? 'No activity in over a month — this role may have gone cold.'
          : 'No activity in a few weeks — worth a follow-up.'}
      </TooltipContent>
    </Tooltip>
  )
}
