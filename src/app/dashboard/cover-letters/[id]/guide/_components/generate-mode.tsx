'use client'

import { useState } from 'react'
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
import {
  analyseRole,
  buildLetterArchitecture,
  draftFromArchitecture,
  reviewDraftPass,
  finaliseFromReview,
} from '@/modules/writing-guide/actions'
import { updateCoverLetterContent } from '@/modules/cover-letters/actions'

type Props = {
  letter: {
    id: string
    content: string
    jobApplication?: { jobDescription?: string | null } | null
  }
  onBack: () => void
}

export function GenerateMode({ letter, onBack }: Props) {
  const [progressLabel, setProgressLabel] = useState<string | null>(null)
  const [pendingContent, setPendingContent] = useState<string | null>(null)
  const router = useRouter()

  const isPending = progressLabel !== null

  async function handleGenerate() {
    setProgressLabel('Analysing role…')

    const briefResult = await analyseRole(letter.id)
    if (!briefResult.ok) {
      setProgressLabel(null)
      toast.error(briefResult.message, {
        action: briefResult.error === 'not_configured'
          ? { label: 'Set up →', onClick: () => router.push('/dashboard/settings/llm') }
          : undefined,
      })
      return
    }

    setProgressLabel('Building message…')
    const archResult = await buildLetterArchitecture(letter.id, briefResult.brief)
    if (!archResult.ok) {
      setProgressLabel(null)
      toast.error(archResult.message)
      return
    }

    setProgressLabel('Writing draft…')
    const draftResult = await draftFromArchitecture(letter.id, archResult.architecture)
    if (!draftResult.ok) {
      setProgressLabel(null)
      toast.error(draftResult.message)
      return
    }

    setProgressLabel('Reviewing…')
    const reviewResult = await reviewDraftPass(letter.id, draftResult.draft, briefResult.brief)
    if (!reviewResult.ok) {
      setProgressLabel(null)
      toast.error(reviewResult.message)
      return
    }

    setProgressLabel('Finalising…')
    const finalResult = await finaliseFromReview(letter.id, draftResult.draft, reviewResult.issues)
    setProgressLabel(null)

    if (!finalResult.ok) {
      toast.error(finalResult.message)
      return
    }

    if (letter.content.trim() !== '') {
      setPendingContent(finalResult.content)
    } else {
      await applyContent(finalResult.content)
    }
  }

  async function applyContent(content: string) {
    await updateCoverLetterContent(letter.id, content)
    router.push(`/dashboard/cover-letters/${letter.id}`)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <button onClick={onBack} className="mb-6 text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </button>

      <h2 className="text-lg font-semibold">Generate a draft</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        AI analyses the role, builds a message structure, writes a draft, reviews it, then finalises. Takes about 30–60 seconds.
      </p>

      {!letter.jobApplication?.jobDescription && (
        <div className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          No job description found. The draft will be based on your profile alone — adding a job description gives better results.
        </div>
      )}

      <Button
        className="mt-6"
        disabled={isPending}
        onClick={handleGenerate}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            {progressLabel}
          </>
        ) : (
          <>
            <Sparkles className="mr-2 size-4" />
            Generate draft
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
            <Button variant="outline" onClick={() => setPendingContent(null)}>
              Cancel
            </Button>
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
