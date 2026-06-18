'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Step1Ai } from './steps/Step1Ai'
import { Step2Profile } from './steps/Step2Profile'
import { Step3Context } from './steps/Step3Context'
import { Step4Start } from './steps/Step4Start'

type ProviderModel = { id: string; name: string }

export type WizardShellProps = {
  initialLlmStatus: {
    configured: boolean
    provider: string
    model: string
    availableModels: ProviderModel[] | null
  }
  initialProfileImported: boolean
  initialCurrentRole: string
}

const STEP_LABELS = ['AI setup', 'Your profile', 'Search context', 'Get started'] as const

export function WizardShell({
  initialLlmStatus,
  initialProfileImported,
  initialCurrentRole,
}: WizardShellProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)

  function advance() {
    if (step < 3) setStep((s) => (s + 1) as 0 | 1 | 2 | 3)
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex gap-1.5">
          {([0, 1, 2, 3] as const).map((i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                i <= step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-right">
          Step {step + 1} of 4 — {STEP_LABELS[step]}
        </p>
      </div>

      {/* Step content */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        {step === 0 && (
          <Step1Ai initialStatus={initialLlmStatus} onNext={advance} onSkip={advance} />
        )}
        {step === 1 && (
          <Step2Profile
            initialProfileImported={initialProfileImported}
            onNext={advance}
            onSkip={advance}
          />
        )}
        {step === 2 && (
          <Step3Context
            initialCurrentRole={initialCurrentRole}
            onNext={advance}
            onSkip={advance}
          />
        )}
        {step === 3 && <Step4Start />}
      </div>
    </div>
  )
}
