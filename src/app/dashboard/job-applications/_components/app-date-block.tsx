'use client'

import { useState, useTransition } from "react"
import { Pencil } from "lucide-react"
import { daysAgo, formatShortDate } from "@/lib/utils"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { updateJobDate } from "@/modules/jobs/mutations"

type ApplicationDateBlockProps = {
  date: Date | null
  label: string
  // When set, the block becomes editable and saves to this job's dateApplied.
  jobId?: string
}

export function ApplicationDateBlock({ label, date, jobId }: ApplicationDateBlockProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState("")

  if (!date) {
    return <div className="text-xs text-muted-foreground/30">—</div>
  }

  function handleOpenChange(next: boolean) {
    if (next && date) setValue(date.toLocaleDateString("en-CA"))
    setOpen(next)
  }

  function handleSubmit() {
    if (!jobId || !value) return
    startTransition(async () => {
      await updateJobDate(jobId, new Date(`${value}T00:00:00`))
      setOpen(false)
    })
  }

  const days = daysAgo(date)
  return (
    <div className="flex flex-col gap-0.5 group/date">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{formatShortDate(date)}</span>
        {jobId && (
          <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger
              aria-label={`Edit ${label.toLowerCase()} date`}
              className="invisible cursor-pointer rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground group-hover/date:visible"
            >
              <Pencil size={10} />
            </PopoverTrigger>
            <PopoverContent className="w-auto">
              <form action={handleSubmit} className="flex flex-col gap-2">
                <span className="text-xs font-medium">Change {label.toLowerCase()} date</span>
                <Input
                  type="date"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </form>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {days !== null && (
        <div className="text-[10px] text-muted-foreground/50">
          {days === 0 ? "today" : `${days}d ago`}
        </div>
      )}
    </div>
  )
}
