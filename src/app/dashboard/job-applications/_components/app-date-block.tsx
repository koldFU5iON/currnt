'use client'

import { useState, useTransition } from "react"
import { Calendar, Pencil } from "lucide-react"
import { daysAgo, formatDate } from "@/lib/utils"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
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
    return <div className="text-xs text-muted-foreground">{label}: —</div>
  }

  function handleOpenChange(next: boolean) {
    // Re-seed the field from the current date each time the popover opens.
    // en-CA locale renders YYYY-MM-DD, the format <input type="date"> expects.
    if (next && date) setValue(date.toLocaleDateString("en-CA"))
    setOpen(next)
  }

  function handleSubmit() {
    if (!jobId || !value) return
    startTransition(async () => {
      // Parse as local midnight so the saved day matches the one picked.
      await updateJobDate(jobId, new Date(`${value}T00:00:00`))
      setOpen(false)
    })
  }

  const days = daysAgo(date)
  return (
    <div className="flex flex-col group">
      <div className="flex justify-between text-xs font-semibold mr-3">{label}:
        {jobId && (
          <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger
              aria-label={`Edit ${label.toLowerCase()} date`}
              className="invisible w-fit cursor-pointer rounded-full border border-accent-foreground bg-primary p-1 transition-opacity hover:invert group-hover:visible"
            >
              <Pencil size={12} className="stroke-white" />
            </PopoverTrigger>
            <PopoverContent className="w-auto">
              <form action={handleSubmit} className="flex flex-col gap-2">
                <span className="text-xs font-medium">
                  Change {label.toLowerCase()} date
                </span>
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
      <div className="flex items-center gap-1 space-x-2 font-bold text-sm">
        <Calendar size={12} /> {formatDate(date)}
      </div>
      {days !== null && (
        <div className="text-xs italic">
          {days === 0 ? "today" : `${days} days ago`}
        </div>
      )}
    </div>
  )
}
