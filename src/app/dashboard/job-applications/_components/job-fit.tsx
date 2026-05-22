import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Flame } from "lucide-react";
import type { JobFit as JobFitType } from "@/app/types/job-application";

export function JobFit({ jobFit }: { jobFit: JobFitType | null }) {
  if (!jobFit) return <div />

  return (
    <Popover>
      <PopoverTrigger>
        <Flame className="fill-amber-500" />
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-sm font-semibold capitalize">{jobFit.label}</p>
        <p className="text-xs text-muted-foreground mt-1">{jobFit.justification}</p>
      </PopoverContent>
    </Popover>
  )
}
