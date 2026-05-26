'use client'

import { useEffect } from 'react'
import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
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
import { FormField } from '../create/_components/form-field'
import { updateJobSchema } from '@/modules/jobs/schema'
import { updateJobApplication } from '@/modules/jobs/mutations'
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
  }
}

export function EditJobDialog({ job, open, onOpenChange }: EditJobDialogProps) {
  const form = useForm<z.infer<typeof updateJobSchema>>({
    resolver: zodResolver(updateJobSchema),
    defaultValues: valuesFromJob(job),
  })

  // Re-prefill whenever the dialog opens or the underlying job changes,
  // so stale form state from a previous edit doesn't bleed through.
  useEffect(() => {
    if (open) form.reset(valuesFromJob(job))
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
          <DialogDescription>
            Update any field. Changes apply when you save.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField name="title" label="Job Title" required />
              <FormField name="company" label="Company" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField name="location" label="Location" placeholder="e.g. London, UK or Remote" />
              <FormField name="jobNumber" label="Job Number" placeholder="e.g. JOB-123" />
            </div>

            <FormField name="url" label="Job URL" type="url" placeholder="https://..." />

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
              name="jobDescription"
              label="Job Description"
              type="textarea"
              placeholder="Job description (markdown supported)"
              rows={16}
            />

            <DialogFooter>
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
