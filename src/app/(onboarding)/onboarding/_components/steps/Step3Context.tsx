'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { saveOnboardingContextData } from '@/modules/onboarding/actions'
import { toast } from 'sonner'

type Props = {
  initialCurrentRole: string
  onNext: () => void
  onSkip: () => void
}

export function Step3Context({ initialCurrentRole, onNext, onSkip }: Props) {
  const [currentRole, setCurrentRole] = useState(initialCurrentRole)
  const [targetRole, setTargetRole] = useState('')
  const [industries, setIndustries] = useState('')
  const [workPreferences, setWorkPreferences] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [saving, startSaveTransition] = useTransition()

  function handleSave() {
    startSaveTransition(async () => {
      try {
        await saveOnboardingContextData({
          currentRole,
          targetRole,
          industries,
          workPreferences,
          extraContext,
        })
        onNext()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
          Search context
        </p>
        <h2 className="text-xl font-bold tracking-tight">What are you looking for?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pre-filled from your profile where we could. Update anything that&apos;s off — this guides job-fit scoring and role suggestions.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="currentRole">Current role</Label>
          <Input
            id="currentRole"
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value)}
            placeholder="e.g. Senior Software Engineer"
            disabled={saving}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="targetRole">Target role</Label>
          <Input
            id="targetRole"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Engineering Manager"
            disabled={saving}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="industries">Industries</Label>
          <Input
            id="industries"
            value={industries}
            onChange={(e) => setIndustries(e.target.value)}
            placeholder="e.g. fintech, climate tech, B2B SaaS"
            disabled={saving}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="workPreferences">Work preferences</Label>
          <Input
            id="workPreferences"
            value={workPreferences}
            onChange={(e) => setWorkPreferences(e.target.value)}
            placeholder="e.g. remote, Series B–C, mission-driven"
            disabled={saving}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="extraContext">Anything else?</Label>
          <Textarea
            id="extraContext"
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder="Constraints, priorities, or anything else that should shape job scoring…"
            rows={3}
            disabled={saving}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save & continue
        </button>
      </div>
    </div>
  )
}
