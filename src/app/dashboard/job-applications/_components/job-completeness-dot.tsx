"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { jobCompleteness, type CompletenessInput } from "@/modules/jobs/completeness"
import { cn } from "@/lib/utils"

const DOT_COLOR = {
  incomplete: "bg-red-500",
  thin: "bg-amber-500",
  complete: "bg-emerald-500",
} as const

const HEADLINE = {
  incomplete: "Missing critical info",
  thin: "Could be more complete",
  complete: "All key fields present",
} as const

export function JobCompletenessDot({ job }: { job: CompletenessInput }) {
  const { level, missing } = jobCompleteness(job)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={`Completeness: ${HEADLINE[level]}`}
            className={cn(
              "inline-block size-2 shrink-0 rounded-full",
              DOT_COLOR[level],
            )}
          />
        }
      />
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">{HEADLINE[level]}</p>
          {missing.length > 0 && (
            <ul className="list-disc pl-3.5 text-background/80">
              {missing.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
