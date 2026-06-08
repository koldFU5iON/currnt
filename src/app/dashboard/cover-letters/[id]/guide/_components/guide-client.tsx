'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChecklistMode } from './checklist-mode'
import { GenerateMode } from './generate-mode'
import { BuildWithMeMode } from './build-with-me-mode'

type Mode = null | 'checklist' | 'generate' | 'build'

type Props = {
  letter: {
    id: string
    content: string
    jobTitle?: string | null
    company?: string | null
    jobApplication?: {
      title?: string | null
      company?: string | null
      jobDescription?: string | null
    } | null
  }
  llmConfigured: boolean
}

export function GuideClient({ letter, llmConfigured }: Props) {
  const [mode, setMode] = useState<Mode>(null)
  const router = useRouter()

  function handleAICardClick(target: 'generate' | 'build') {
    if (!llmConfigured) {
      toast.error('AI not configured', {
        action: { label: 'Set up →', onClick: () => router.push('/dashboard/settings/llm') },
      })
      return
    }
    setMode(target)
  }

  if (mode === 'checklist') return <ChecklistMode onBack={() => setMode(null)} />
  if (mode === 'generate') return <GenerateMode letter={letter} onBack={() => setMode(null)} />
  if (mode === 'build') return <BuildWithMeMode letter={letter} onBack={() => setMode(null)} />

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-lg font-semibold">How would you like to start?</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Three ways to get your first draft.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={() => setMode('checklist')}
          className="rounded-lg border border-border bg-card p-4 text-left hover:bg-accent/50 transition-colors"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">No AI needed</p>
          <p className="mt-1 font-semibold">Writing checklist</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Structured tips and prompts to guide your writing.</p>
        </button>

        <button
          onClick={() => handleAICardClick('generate')}
          className="rounded-lg border border-border bg-card p-4 text-left hover:bg-accent/50 transition-colors"
          style={!llmConfigured ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">✦ AI</p>
          <p className="mt-1 font-semibold">Generate a draft</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            AI writes from your profile, CV, and job description.
          </p>
        </button>

        <button
          onClick={() => handleAICardClick('build')}
          className="rounded-lg border border-border bg-card p-4 text-left hover:bg-accent/50 transition-colors"
          style={!llmConfigured ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">✦ AI</p>
          <p className="mt-1 font-semibold">Build with me</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Answer a few questions. AI uses your answers to write the letter.
          </p>
        </button>
      </div>

      {!llmConfigured && (
        <div className="mt-4 flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <span>✦ AI features require an API key.</span>
          <a href="/dashboard/settings/llm" className="font-semibold text-primary hover:underline">
            Set up →
          </a>
        </div>
      )}
    </div>
  )
}
