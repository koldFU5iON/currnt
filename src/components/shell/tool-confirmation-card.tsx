'use client'

import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  toolName: string
  args: Record<string, unknown>
  onAccept: () => void
  onReject: () => void
}

const TOOL_LABELS: Record<string, string> = {
  propose_profile_update: 'Update profile field',
  propose_cv_update: 'Update CV section',
  propose_prep_note_update: 'Update prep note',
}

export function ToolConfirmationCard({ toolName, args, onAccept, onReject }: Props) {
  const label = TOOL_LABELS[toolName] ?? 'Proposed change'
  return (
    <div className="w-full rounded-xl border border-border bg-background p-3 text-sm shadow-sm">
      <p className="mb-2 font-medium text-foreground">{label}</p>
      {args.rationale != null && (
        <p className="mb-3 text-xs text-muted-foreground">{String(args.rationale)}</p>
      )}
      {args.currentValue !== undefined && (
        <div className="mb-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700 line-through dark:bg-red-950 dark:text-red-400">
          {String(args.currentValue)}
        </div>
      )}
      {(args.proposedValue ?? args.proposedContent) !== undefined && (
        <div className="mb-3 rounded-md bg-green-50 px-2.5 py-1.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-400">
          {String(args.proposedValue ?? args.proposedContent)}
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" className="h-7 gap-1 text-xs" onClick={onAccept}>
          <Check className="size-3" />Accept
        </Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={onReject}>
          <X className="size-3" />Decline
        </Button>
      </div>
    </div>
  )
}
