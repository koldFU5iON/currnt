'use client'

import { useState } from 'react'
import { Check, X, Bug, Lightbulb, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createFeedbackIssue, type FeedbackType } from '@/modules/feedback/actions'
import { toast } from 'sonner'

type Props = {
  toolCallId: string
  type: 'bug' | 'idea'
  title: string
  description: string
  onResult: (toolCallId: string, output: { status: string }) => void
}

export function FeedbackSubmissionCard({ toolCallId, type, title, description, onResult }: Props) {
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  async function handleAccept() {
    setPending(true)
    const result = await createFeedbackIssue(
      type as FeedbackType,
      title,
      description,
      typeof window !== 'undefined' ? window.location.pathname : '/dashboard',
    )
    setPending(false)
    if (result.ok) {
      setDone(true)
      onResult(toolCallId, { status: 'submitted' })
    } else {
      toast.error(result.message ?? 'Failed to submit feedback')
      onResult(toolCallId, { status: 'error' })
    }
  }

  function handleReject() {
    onResult(toolCallId, { status: 'rejected' })
  }

  if (done) return null

  return (
    <div className="w-full rounded-xl border border-border bg-background p-3 text-sm shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        {type === 'bug' ? (
          <Bug className="size-4 text-red-500" />
        ) : (
          <Lightbulb className="size-4 text-yellow-500" />
        )}
        <span className="font-medium text-foreground capitalize">{type === 'bug' ? 'Bug report' : 'Feature idea'}</span>
      </div>
      <p className="mb-1 text-xs font-medium text-foreground">{title}</p>
      {description && (
        <p className="mb-3 text-xs text-muted-foreground line-clamp-3">{description}</p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={handleAccept}
          disabled={pending}
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          Submit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs"
          onClick={handleReject}
          disabled={pending}
        >
          <X className="size-3" />
          Cancel
        </Button>
      </div>
    </div>
  )
}
