'use client'

import { useEffect, useState, useTransition } from 'react'
import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { JobFormFields } from './job-form-fields'
import { DuplicateWarning } from './duplicate-warning'
import { createJobSchema } from '@/modules/jobs/schema'
import { createJobApplication } from '@/modules/jobs/mutations'
import { extractJobFromUrl } from '@/modules/jobs/extract'
import { applyExtractedData } from '@/modules/jobs/form-utils'
import { findPotentialDuplicates } from '@/modules/jobs/dedup'
import type { DuplicateMatch } from '@/modules/jobs/dedup-internal'

type CreateJobSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialUrl?: string
}

const DEFAULT_VALUES: z.infer<typeof createJobSchema> = {
  title: '',
  company: '',
  url: '',
  location: '',
  jobNumber: '',
  salaryBand: '',
  jobDescription: '',
  datePublished: new Date(),
  applicationSource: 'cold',
}

export function CreateJobSheet({ open, onOpenChange, initialUrl }: CreateJobSheetProps) {
  const isMobile = useIsMobile()
  const router = useRouter()
  const [isExtracting, startExtraction] = useTransition()
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [acknowledgedDupes, setAcknowledgedDupes] = useState(false)

  const form = useForm<z.infer<typeof createJobSchema>>({
    resolver: zodResolver(createJobSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (open) {
      form.reset({ ...DEFAULT_VALUES, url: initialUrl ?? '' })
      setDuplicates([]) // eslint-disable-line react-hooks/set-state-in-effect
      setAcknowledgedDupes(false)
    }
  }, [open, initialUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleExtract() {
    const url = form.getValues('url')
    if (!url) { toast.error('Paste a job URL first'); return }
    startExtraction(async () => {
      const result = await extractJobFromUrl(url)
      if (!result.ok) { toast.error(result.error); return }
      applyExtractedData(form, result.data)
      toast.success('Details extracted — review and submit')
      if (result.data.title && result.data.company) {
        const matches = await findPotentialDuplicates({
          jobNumber: result.data.jobNumber,
          title: result.data.title,
          company: result.data.company,
        })
        setDuplicates(matches)
        setAcknowledgedDupes(false)
      }
    })
  }

  async function onSubmit(data: z.infer<typeof createJobSchema>) {
    try {
      const matches = await findPotentialDuplicates({
        jobNumber: data.jobNumber,
        title: data.title,
        company: data.company,
      })
      setDuplicates(matches)
      if (matches.length > 0 && !acknowledgedDupes) {
        setAcknowledgedDupes(true)
        toast.warning('Possible duplicate — submit again to create anyway')
        return
      }
      await createJobApplication(data)
      toast.success('Job application created')
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error('Failed to create job application')
    }
  }

  const formBody = (
    <FormProvider {...form}>
      <form
        id="create-job-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-1"
      >
        <JobFormFields isExtracting={isExtracting} onExtract={handleExtract} />
        <DuplicateWarning matches={duplicates} />
      </form>
    </FormProvider>
  )

  const submitLabel = form.formState.isSubmitting
    ? 'Creating…'
    : duplicates.length > 0 && acknowledgedDupes
      ? 'Create anyway'
      : 'Create Job Application'

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>Add Job Application</DrawerTitle>
            <DrawerDescription>Paste a URL and extract, or fill in the details manually.</DrawerDescription>
          </DrawerHeader>
          {formBody}
          <DrawerFooter className="flex-row justify-end gap-2">
            <DrawerClose asChild>
              <Button type="button" variant="outline" className="flex-1" disabled={form.formState.isSubmitting}>
                Cancel
              </Button>
            </DrawerClose>
            <Button type="submit" form="create-job-form" disabled={form.formState.isSubmitting} className="flex-1">
              {submitLabel}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg flex flex-col p-0 gap-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/40 shrink-0">
          <SheetTitle>Add Job Application</SheetTitle>
          <SheetDescription>Paste a URL and extract, or fill in the details manually.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {formBody}
        </div>
        <SheetFooter className="px-4 py-3 border-t border-border/40 shrink-0 flex-row gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" form="create-job-form" disabled={form.formState.isSubmitting} className="flex-1">
            {submitLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
