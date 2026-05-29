'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { updateWritingBrief } from '@/modules/llm/actions'
import { toast } from 'sonner'

type Props = {
  initialBrief: string | null
  writingRules: string
}

export function AIWritingForm({ initialBrief, writingRules }: Props) {
  const [saved, setSaved] = useState(initialBrief ?? '')
  const [draft, setDraft] = useState(saved)
  const [isPending, startTransition] = useTransition()
  const [rulesExpanded, setRulesExpanded] = useState(false)

  const isDirty = draft !== saved

  function handleSave() {
    startTransition(async () => {
      try {
        await updateWritingBrief(draft)
        const trimmed = draft.trim()
        setSaved(trimmed)
        setDraft(trimmed)
        toast.success(trimmed ? 'Writing brief saved.' : 'Writing brief cleared.')
      } catch {
        toast.error('Failed to save. Please try again.')
      }
    })
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="writing-brief">Writing brief</Label>
        <Textarea
          id="writing-brief"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="How do you want AI to represent you? E.g. 'I'm a senior IC not a people manager', 'prefer direct language over corporate tone', 'transitioning from finance to tech, lean into transferable skills'…"
          rows={5}
          disabled={isPending}
          className="resize-none text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Added to every AI writing call alongside the quality rules below. Leave blank to use defaults only.
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={handleSave}
        disabled={isPending || !isDirty}
      >
        {isPending ? 'Saving…' : 'Save'}
      </Button>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setRulesExpanded(v => !v)}
          className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground text-muted-foreground transition-colors"
          aria-expanded={rulesExpanded}
        >
          {rulesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Writing rules applied to all AI output
        </button>
        {rulesExpanded && (
          <pre className="rounded-md border bg-muted/40 p-4 text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {writingRules}
          </pre>
        )}
      </div>
    </div>
  )
}
