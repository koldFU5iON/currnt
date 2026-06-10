'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildWithMe } from '@/modules/writing-guide/actions'
import { updateCoverLetterContent } from '@/modules/cover-letters/actions'
import type { BuildWithMeInputs } from '@/modules/writing-guide/schema'

type Props = {
  letter: {
    id: string
    content: string
    jobApplication?: { jobDescription?: string | null } | null
  }
  onBack: () => void
}

const STORAGE_KEY = (id: string) => `writing-guide-${id}`

const QUESTIONS: { field: keyof BuildWithMeInputs; label: string; placeholder: string }[] = [
  { field: 'whyRole',       label: 'Why are you interested in this role?',                        placeholder: 'What specifically about this role attracted you…' },
  { field: 'whyCompany',    label: 'Why are you interested in this company?',                     placeholder: 'What about the company, its mission, or its work…' },
  { field: 'bestEvidence',  label: 'Which experience or achievement best proves your fit?',       placeholder: 'A specific project, metric, or outcome…' },
  { field: 'whyNow',        label: 'Why are you making this move now?',                           placeholder: "What's driving your decision to look for a new role…" },
  { field: 'anythingElse',  label: 'Is there anything else the hiring manager should know?',      placeholder: "Any context that isn't obvious from your CV…" },
]

export function BuildWithMeMode({ letter, onBack }: Props) {
  const storageKey = STORAGE_KEY(letter.id)
  const [answers, setAnswers] = useState<BuildWithMeInputs>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved) as BuildWithMeInputs
    } catch {}
    return {}
  })
  const [isPending, setIsPending] = useState(false)
  const [pendingContent, setPendingContent] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  function handleChange(field: keyof BuildWithMeInputs, value: string) {
    const updated = { ...answers, [field]: value }
    setAnswers(updated)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(updated)) } catch {}
    }, 500)
  }

  const hasAnyAnswer = Object.values(answers).some(v => v?.trim())

  async function handleSubmit() {
    setIsPending(true)
    const result = await buildWithMe(letter.id, answers)
    setIsPending(false)

    if (!result.ok) {
      toast.error(result.message, {
        action: result.error === 'not_configured'
          ? { label: 'Set up →', onClick: () => router.push('/dashboard/settings/llm') }
          : undefined,
      })
      return
    }

    if (letter.content.trim() !== '') {
      setPendingContent(result.content)
    } else {
      await applyContent(result.content)
    }
  }

  async function applyContent(content: string) {
    await updateCoverLetterContent(letter.id, content)
    try { localStorage.removeItem(storageKey) } catch {}
    router.push(`/dashboard/cover-letters/${letter.id}`)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <button onClick={onBack} className="mb-6 text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </button>

      <h2 className="text-lg font-semibold">Build with me</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Answer as many questions as you like — all are optional. Your answers are saved automatically.
      </p>

      {!letter.jobApplication?.jobDescription && (
        <div className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          No job description found. The draft will be based on your profile and answers alone — adding a job description gives better results.
        </div>
      )}

      <div className="mt-6 space-y-5">
        {QUESTIONS.map(({ field, label, placeholder }) => (
          <div key={field}>
            <label className="block text-sm font-medium">{label}</label>
            <textarea
              value={answers[field] ?? ''}
              onChange={e => handleChange(field, e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/50"
            />
          </div>
        ))}
      </div>

      <Button
        className="mt-6"
        disabled={isPending || !hasAnyAnswer}
        onClick={handleSubmit}
        title={!hasAnyAnswer ? 'Answer at least one question to continue' : undefined}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 size-4" />
            Build my draft
          </>
        )}
      </Button>

      <Dialog open={pendingContent !== null} onOpenChange={() => setPendingContent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace existing draft?</DialogTitle>
            <DialogDescription>
              This will replace your current cover letter content. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingContent(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingContent) applyContent(pendingContent)
                setPendingContent(null)
              }}
            >
              Replace draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
