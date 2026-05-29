'use client'

import { useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createFeedbackIssue } from '@/modules/feedback/actions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type FeedbackType = 'bug' | 'idea' | 'other'

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idea' },
  { value: 'other', label: 'Other' },
]

const DESCRIPTION_PLACEHOLDERS: Record<FeedbackType, string> = {
  bug: 'Steps to reproduce, or anything else useful…',
  idea: 'What problem would this solve?…',
  other: 'Any extra context…',
}

const FALLBACK_URL = 'https://github.com/koldFU5iON/resume/issues/new'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDrawer({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile()
  const pathname = usePathname()

  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPending, startTransition] = useTransition()

  function reset() {
    setType('bug')
    setTitle('')
    setDescription('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await createFeedbackIssue(type, title, description, pathname)
      if (result.ok) {
        toast.success('Issue filed — thanks!')
        handleOpenChange(false)
      } else {
        toast.error(result.message, {
          action: {
            label: 'Open on GitHub',
            onClick: () => {
              window.open(
                `${FALLBACK_URL}?title=${encodeURIComponent(title)}`,
                '_blank',
              )
            },
          },
        })
      }
    })
  }

  const typeToggle = (
    <div className="flex gap-1 rounded-md bg-muted p-1">
      {TYPES.map(t => (
        <button
          key={t.value}
          type="button"
          onClick={() => setType(t.value)}
          disabled={isPending}
          className={cn(
            'flex-1 rounded px-3 py-1 text-xs font-medium transition-colors',
            type === t.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )

  const formFields = (
    <div className="space-y-4">
      {typeToggle}
      <div className="space-y-1.5">
        <Label htmlFor="feedback-title">Title</Label>
        <Input
          id="feedback-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Short description…"
          disabled={isPending}
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="feedback-description">
          Description{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="feedback-description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={DESCRIPTION_PLACEHOLDERS[type]}
          rows={3}
          disabled={isPending}
          className="resize-none text-sm"
        />
      </div>
    </div>
  )

  const submitButton = (
    <Button
      type="button"
      size="sm"
      onClick={handleSubmit}
      disabled={isPending || !title.trim()}
    >
      {isPending ? 'Submitting…' : 'Submit report'}
    </Button>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Report an issue</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2">{formFields}</div>
          <DrawerFooter className="flex-row justify-end gap-2">
            <DrawerClose>
              <Button type="button" variant="outline" size="sm" disabled={isPending}>
                Cancel
              </Button>
            </DrawerClose>
            {submitButton}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
        </DialogHeader>
        <div className="px-4">{formFields}</div>
        <DialogFooter>
          {submitButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
