'use client'

import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { TrendingUp } from 'lucide-react'
import { SalaryEstimate } from './salary-estimate'
import type { SalaryEstimate as SalaryEstimateType } from '@/app/types/job-application'

type Props = {
  jobId: string
  initialEstimate: SalaryEstimateType | null
  hasJD: boolean
  hasLLMKey: boolean
}

export function SalaryPopover({ jobId, initialEstimate, hasJD, hasLLMKey }: Props) {
  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
        aria-label="Salary estimate"
      >
        <TrendingUp size={11} />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-64 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Salary estimate
        </p>
        <SalaryEstimate
          jobId={jobId}
          initialEstimate={initialEstimate}
          hasJD={hasJD}
          hasLLMKey={hasLLMKey}
        />
      </PopoverContent>
    </Popover>
  )
}
