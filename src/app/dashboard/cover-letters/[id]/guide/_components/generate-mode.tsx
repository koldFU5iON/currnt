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
import { generateDraft } from '@/modules/writing-guide/actions'
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
  const [isPending, setIsPending] = useState(false)
  const [pendingContent, setPendingContent] = useState<string | null>(null)
  const router = useRouter()

  async function handleGenerate() {
    setIsPending(true)
    const result = await generateDraft(letter.id)
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
    router.push(`/dashboard/cover-letters/${letter.id}`)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <button onClick={onBack} className="mb-6 text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </button>

      <h2 className="text-lg font-semibold">Generate a draft</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        AI writes a full first draft using your profile, CV, and the job description. Takes about 10–20 seconds.
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
            Generating…
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
