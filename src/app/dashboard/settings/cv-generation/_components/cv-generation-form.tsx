'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { updateCVGenerationSettings } from '../_actions'

type Props = {
  initialMergeRepeatedEmployers: boolean
}

export function CVGenerationForm({ initialMergeRepeatedEmployers }: Props) {
  const [mergeRepeatedEmployers, setMergeRepeatedEmployers] = useState(
    initialMergeRepeatedEmployers,
  )
  const [isPending, startTransition] = useTransition()

  function handleToggle(checked: boolean) {
    setMergeRepeatedEmployers(checked)
    startTransition(async () => {
      try {
        await updateCVGenerationSettings({ mergeRepeatedEmployers: checked })
        toast.success('CV generation settings saved.')
      } catch {
        setMergeRepeatedEmployers(!checked)
        toast.error('Failed to save. Please try again.')
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-4">
        <Switch
          id="merge-employers"
          checked={mergeRepeatedEmployers}
          onCheckedChange={handleToggle}
          disabled={isPending}
        />
        <div className="space-y-1">
          <Label htmlFor="merge-employers" className="text-sm font-medium leading-none">
            Merge repeated employers
          </Label>
          <p className="text-xs text-muted-foreground">
            When you&apos;ve held multiple roles at the same company, the AI will produce one
            entry showing your full tenure and promotion journey rather than separate sections.
          </p>
        </div>
      </div>
    </div>
  )
}
