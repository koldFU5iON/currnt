'use client'

import { useState, useTransition } from "react"
import { StickyNote } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { updateJobNotes } from "@/modules/jobs/mutations"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type JobNotesProps = {
  jobId: string
  initialNotes: string | null
}

export function JobNotes({ jobId, initialNotes }: JobNotesProps) {
  const [saved, setSaved] = useState(initialNotes ?? '')
  const [draft, setDraft] = useState(saved)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const hasNotes = saved.trim().length > 0
  const isDirty = draft !== saved

  function handleOpenChange(next: boolean) {
    if (next) setDraft(saved)
    setOpen(next)
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateJobNotes(jobId, draft)
        const trimmed = draft.trim()
        setSaved(trimmed)
        setDraft(trimmed)
        setOpen(false)
        toast.success(trimmed ? 'Note saved.' : 'Note cleared.')
      } catch {
        toast.error('Failed to save note. Please try again.')
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label={hasNotes ? 'View note' : 'Add note'}
        title={hasNotes ? 'View note' : 'Add note'}
        className={cn(
          "flex size-6 items-center justify-center rounded-md transition-colors",
          hasNotes
            ? "hover:bg-muted/50"
            : "text-muted-foreground/40 hover:bg-muted hover:text-foreground",
        )}
      >
        <StickyNote
          size={14}
          className={hasNotes ? 'fill-amber-200 text-amber-500' : ''}
        />
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-3">
          <p className="text-sm font-semibold">Notes</p>
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Add a note..."
            rows={4}
            disabled={isPending}
            className="resize-none text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isPending || !isDirty}
            >
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
