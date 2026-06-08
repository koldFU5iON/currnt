'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { reviewLetter } from '@/modules/writing-guide/actions'
import { ReviewResults } from '@/app/dashboard/cover-letters/[id]/review/_components/review-results'
import type { ReviewOutput } from '@/modules/writing-guide/schema'

type ReviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; review: ReviewOutput }
  | { status: 'error'; message: string }

type Props = {
  letterId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReviewDrawer({ letterId, open, onOpenChange }: Props) {
  const [state, setState] = useState<ReviewState>({ status: 'idle' })
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!open) return
    setState({ status: 'loading' })
    reviewLetter(letterId).then(result => {
      if (result.ok) {
        setState({ status: 'done', review: result.review })
      } else {
        setState({ status: 'error', message: result.message })
      }
    })
  }, [open, letterId])

  const body = (
    <>
      {state.status === 'loading' && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Reviewing…</span>
        </div>
      )}
      {state.status === 'error' && (
        <p className="px-4 py-8 text-sm text-destructive">{state.message}</p>
      )}
      {state.status === 'done' && <ReviewResults review={state.review} />}
    </>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] flex flex-col">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>✦ Review</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto">{body}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] overflow-y-auto p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle>✦ Review</SheetTitle>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )
}
