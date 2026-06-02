'use client'

import { useEffect, useState, useTransition } from 'react'
import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import { Loader2, RefreshCw, SquareArrowOutUpRight } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { FormField } from '../create/_components/form-field'
import { updateJobSchema } from '@/modules/jobs/schema'
import { updateJobApplication } from '@/modules/jobs/mutations'
import { extractJobFromUrl } from '@/modules/jobs/extract'
import { notifyUsageUpdated } from '@/lib/usage-events'
import { cn } from '@/lib/utils'
import {
  APPLICATION_SOURCES,
  APPLICATION_SOURCE_LABEL,
  type Job,
} from '@/app/types/job-application'

const SOURCE_OPTIONS = APPLICATION_SOURCES.map(value => ({
  value,
  label: APPLICATION_SOURCE_LABEL[value],
}))

type EditJobDialogProps = {
  job: Job
  open: boolean
  onOpenChange: (open: boolean) => void
}

function valuesFromJob(job: Job): z.infer<typeof updateJobSchema> {
  return {
    title: job.title,
    company: job.company,
    url: job.url ?? '',
    location: job.countries.join(', '),
    jobNumber: job.jobNumber ?? '',
    jobDescription: job.jobDescription ?? '',
    datePublished: job.datePublished ?? undefined,
    applicationSource: job.applicationSource,
    salaryBand: job.salaryBand ?? '',
  }
}

export function EditJobDialog({ job, open, onOpenChange }: EditJobDialogProps) {
  const form = useForm<z.infer<typeof updateJobSchema>>({
    resolver: zodResolver(updateJobSchema),
    defaultValues: valuesFromJob(job),
  })

  const [isExtracting, startExtraction] = useTransition()
  const [extractLabel, setExtractLabel] = useState('Re-extract')

  // Re-prefill whenever the dialog opens or the underlying job changes,
  // so stale form state from a previous edit doesn't bleed through.
  useEffect(() => {
    if (open) {
      form.reset(valuesFromJob(job))
      setExtractLabel('Re-extract')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job.id])

  async function onSubmit(data: z.infer<typeof updateJobSchema>) {
    try {
      await updateJobApplication(job.id, data)
      toast.success('Job updated')
      onOpenChange(false)
    } catch {
      toast.error('Failed to update job')
    }
  }

  function handleExtract() {
    const url = form.getValues('url')
    if (!url) return
    startExtraction(async () => {
      setExtractLabel('Extracting…')
      const result = await extractJobFromUrl(url)
      if (!result.ok) {
        toast.error(result.error)
        setExtractLabel('Re-extract')
        return
      }
      const d = result.data
      if (d.title)          form.setValue('title', d.title)
      if (d.company)        form.setValue('company', d.company)
      if (d.location)       form.setValue('location', d.location)
      if (d.jobDescription) form.setValue('jobDescription', d.jobDescription)
      if (d.jobNumber)      form.setValue('jobNumber', d.jobNumber)
      if (d.salaryBand)     form.setValue('salaryBand', d.salaryBand)
      if (d.datePublished)  form.setValue('datePublished', d.datePublished)
      notifyUsageUpdated()
      toast.success('Details refreshed — review and save')
      setExtractLabel('Re-extract')
    })
  }

  const urlValue = form.watch('url')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit Job</DialogTitle>
          <DialogDescription>
            Update any field. Changes apply when you save.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField name="title" label="Job Title" required />
                <FormField name="company" label="Company" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField name="location" label="Location" placeholder="e.g. London, UK or Remote" />
                <FormField name="jobNumber" label="Job Number" placeholder="e.g. JOB-123" />
              </div>

              {/* URL with re-extract button */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Job URL</label>
                <InputGroup>
                  <InputGroupInput
                    type="url"
                    placeholder="https://..."
                    {...form.register('url')}
                  />
                  <InputGroupAddon align="inline-end">
                    <a
                      href={urlValue || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open job listing"
                      tabIndex={urlValue ? 0 : -1}
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-[calc(var(--radius)-3px)] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                        !urlValue && "pointer-events-none opacity-40",
                      )}
                    >
                      <SquareArrowOutUpRight size={13} />
                    </a>
                    <InputGroupButton
                      type="button"
                      onClick={handleExtract}
                      disabled={isExtracting || !urlValue}
                    >
                      {isExtracting
                        ? <><Loader2 size={13} className="animate-spin" /> Extracting…</>
                        : <><RefreshCw size={13} /> {extractLabel}</>
                      }
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField name="datePublished" label="Date Published" type="date" />
                <FormField
                  name="applicationSource"
                  label="Source"
                  type="select"
                  options={SOURCE_OPTIONS}
                />
              </div>

              <FormField
                name="salaryBand"
                label="Salary Band"
                placeholder="e.g. $120–140k"
              />

              <FormField
                name="jobDescription"
                label="Job Description"
                type="textarea"
                placeholder="Job description (markdown supported)"
                rows={16}
              />
            </div>

            <DialogFooter className="shrink-0 pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
