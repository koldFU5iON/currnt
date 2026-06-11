'use client'

import { useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { LocationTagsInput } from './location-tags-input'
import { updateWatch, retryAtsDiscovery } from '@/modules/job-hunt/actions'
import { UpdateWatchInputSchema, type UpdateWatchInput } from '@/modules/job-hunt/schema'
import type { CompanyWatch } from '@prisma/client'

type Props = {
  watch: CompanyWatch
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditWatchSheet({ watch, open, onOpenChange }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isRetrying, startRetryTransition] = useTransition()
  const [retryUrl, setRetryUrl] = useState(watch.website)
  const [retryError, setRetryError] = useState<string | null>(null)
  const router = useRouter()

  const form = useForm<UpdateWatchInput>({
    resolver: zodResolver(UpdateWatchInputSchema) as never,
    values: {
      watchId: watch.id,
      searchLocations: watch.searchLocations,
      includeRemote: watch.includeRemote,
    },
  })

  function onSubmit(data: UpdateWatchInput) {
    startTransition(async () => {
      const result = await updateWatch(data)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Location filter updated')
      onOpenChange(false)
      router.refresh()
    })
  }

  function handleRetry() {
    setRetryError(null)
    startRetryTransition(async () => {
      const result = await retryAtsDiscovery({ watchId: watch.id, website: retryUrl })
      if (!result.ok) {
        setRetryError(result.error)
        return
      }
      toast.success(`Detected: ${result.provider}${result.boardSlug ? ` (${result.boardSlug})` : ''}`)
      router.refresh()
    })
  }

  const atsLabel = watch.atsProvider === 'unknown'
    ? 'Not detected'
    : `${watch.atsProvider}${watch.boardSlug ? ` · ${watch.boardSlug}` : ''}`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit {watch.name}</SheetTitle>
          <SheetDescription>
            Adjust location preferences or re-detect the ATS for this company watch.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 py-6">
          <Controller
            control={form.control}
            name="searchLocations"
            render={({ field }) => (
              <Field>
                <FieldLabel>Locations <span className="text-muted-foreground font-normal">(optional)</span></FieldLabel>
                <LocationTagsInput value={field.value} onChange={field.onChange} />
                <p className="text-xs text-muted-foreground">Leave empty to see all locations. Press Enter or comma to add each location.</p>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="includeRemote"
            render={({ field }) => (
              <Field>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="editIncludeRemote"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <FieldLabel htmlFor="editIncludeRemote" className="cursor-pointer">
                    Include remote listings
                  </FieldLabel>
                </div>
                <p className="text-xs text-muted-foreground ml-6">Includes roles listed as &quot;Remote&quot;, &quot;US-Remote&quot;, etc.</p>
              </Field>
            )}
          />

          {/* ATS re-detection */}
          <div className="border-t pt-4 space-y-3">
            <div>
              <p className="text-sm font-medium">ATS detection</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current: <span className="font-mono">{atsLabel}</span>
                {watch.status === 'discovery_failed' && (
                  <span className="text-destructive ml-1">· failed</span>
                )}
              </p>
            </div>
            <Field>
              <FieldLabel>Re-detect with URL</FieldLabel>
              <Input
                value={retryUrl}
                onChange={(e) => { setRetryUrl(e.target.value); setRetryError(null) }}
                placeholder="https://company.com or https://boards.greenhouse.io/…"
              />
              <p className="text-xs text-muted-foreground">
                Paste the company website, careers page, or a direct ATS board URL.
              </p>
              {retryError && <FieldError errors={[{ message: retryError }]} />}
            </Field>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying || !retryUrl.trim()}
            >
              {isRetrying
                ? <Loader2 className="size-3.5 animate-spin mr-1.5" />
                : <RefreshCw className="size-3.5 mr-1.5" />}
              {isRetrying ? 'Detecting…' : 'Re-detect ATS'}
            </Button>
          </div>
        </form>

        <SheetFooter className="px-4">
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
