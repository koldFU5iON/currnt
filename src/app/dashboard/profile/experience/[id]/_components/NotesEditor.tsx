'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { updateExperienceNotes } from '@/modules/profile/actions'
import { Loader2, Save } from 'lucide-react'

// Shapes passed down from the server component — used by ExtractionPanel later.
type ExistingActivity = { id: string; description: string; kind: string }
type ExistingSkill = { id: string; name: string }

type Props = {
  experienceId: string
  initialNotes: string
  existingActivities: ExistingActivity[]
  existingSkills: ExistingSkill[]
}

const TAG_LEGEND = [
  { tag: '## Overview', desc: 'Free-form context about the role' },
  { tag: '## Responsibilities', desc: 'Ongoing duties and scope of work' },
  { tag: '## Achievements', desc: 'Specific outcomes and measurable results' },
  { tag: '## Skills', desc: 'Technologies, tools, and methodologies' },
] as const

export function NotesEditor({
  experienceId,
  initialNotes,
  existingActivities,
  existingSkills,
}: Props) {
  const [notes, setNotes] = useState(initialNotes)
  const [saved, setSaved] = useState(true)
  const [isPending, startTransition] = useTransition()

  const handleChange = (value: string) => {
    setNotes(value)
    setSaved(false)
  }

  const handleSave = () => {
    startTransition(async () => {
      await updateExperienceNotes(experienceId, notes)
      setSaved(true)
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="notes-textarea" className="text-base font-medium">
            Notes
          </Label>
          <Button
            size="sm"
            variant={saved ? 'secondary' : 'default'}
            disabled={isPending || saved}
            onClick={handleSave}
            className="gap-1.5"
          >
            {isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}
            {isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </Button>
        </div>

        <textarea
          id="notes-textarea"
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          rows={18}
          spellCheck
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          placeholder={`Paste anything about this role — old CV bullets, LinkedIn copy, performance review notes, or just write from memory.\n\nOptionally use these headings to improve extraction:\n\n## Overview\n## Responsibilities\n## Achievements\n## Skills`}
        />

        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Optional headings — add them to improve extraction quality:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {TAG_LEGEND.map(({ tag, desc }) => (
              <div key={tag} className="flex gap-2 text-xs">
                <code className="text-foreground shrink-0">{tag}</code>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Under each heading, write bullet points starting with{' '}
            <code>-</code> or <code>*</code>. Add{' '}
            <code>{'>'} impact text</code> on the next line to attach a measurable outcome to the preceding bullet.
          </p>
        </div>
      </div>

      {/* ExtractionPanel mounts here in step 7 */}
    </div>
  )
}
