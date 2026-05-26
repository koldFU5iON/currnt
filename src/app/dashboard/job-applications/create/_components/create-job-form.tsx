'use client'

import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormField } from './form-field'
import { createJobSchema } from '@/modules/jobs/schema'
import { createJobApplication } from '@/modules/jobs/mutations'
import { extractJobFromUrl } from '@/modules/jobs/extract'
import { findPotentialDuplicates, type DuplicateMatch } from '@/modules/jobs/dedup'
import { DuplicateWarning } from '../../_components/duplicate-warning'
import { APPLICATION_SOURCES, APPLICATION_SOURCE_LABEL } from '@/app/types/job-application'
import { toast } from 'sonner'

const SOURCE_OPTIONS = APPLICATION_SOURCES.map(value => ({
  value,
  label: APPLICATION_SOURCE_LABEL[value],
}))

export function CreateJobForm() {
  const [extracting, setExtracting] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [acknowledgedDupes, setAcknowledgedDupes] = useState(false)
  const router = useRouter()

  const form = useForm<z.infer<typeof createJobSchema>>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      title: '',
      company: '',
      url: '',
      location: '',
      jobNumber: '',
      jobDescription: '',
      datePublished: new Date(),
      applicationSource: 'cold',
    },
  })

  async function handleExtract() {
    const url = form.getValues('url')
    if (!url) {
      toast.error('Paste a job URL first')
      return
    }
    setExtracting(true)
    try {
      const result = await extractJobFromUrl(url)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const { data } = result
      if (data.title) form.setValue('title', data.title, { shouldValidate: true })
      if (data.company) form.setValue('company', data.company, { shouldValidate: true })
      if (data.location) form.setValue('location', data.location)
      if (data.jobDescription) form.setValue('jobDescription', data.jobDescription)
      if (data.jobNumber) form.setValue('jobNumber', data.jobNumber)
      if (data.datePublished) form.setValue('datePublished', data.datePublished)
      toast.success('Details extracted — review and submit')

      // Re-check for duplicates against the freshly-extracted values
      if (data.title && data.company) {
        const matches = await findPotentialDuplicates({
          jobNumber: data.jobNumber,
          title: data.title,
          company: data.company,
        })
        setDuplicates(matches)
        setAcknowledgedDupes(false)
      }
    } finally {
      setExtracting(false)
    }
  }

  async function onSubmit(data: z.infer<typeof createJobSchema>) {
    try {
      // Final guard — catches manual-entry duplicates that didn't go through extract.
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
      router.push('/dashboard/job-applications')
    } catch {
      toast.error('Failed to create job application')
    }
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        <div className="space-y-2">
          <FormField name="url" label="Job URL" type="url" placeholder="https://company.com/jobs/123" />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={handleExtract}
            disabled={extracting}
          >
            {extracting
              ? <Loader2 size={14} className="animate-spin" />
              : <Sparkles size={14} />}
            {extracting ? 'Extracting...' : 'Extract from URL'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField name="title" label="Job Title" placeholder="e.g. Senior Product Manager" required />
          <FormField name="company" label="Company" placeholder="e.g. Google" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField name="location" label="Location" placeholder="e.g. London, UK or Remote" />
          <FormField name="jobNumber" label="Job Number" placeholder="e.g. JOB-123" />
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
          name="jobDescription"
          label="Job Description"
          type="textarea"
          placeholder="Paste or extract the full job description (markdown supported)"
        />

        <DuplicateWarning matches={duplicates} />

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting
            ? 'Creating...'
            : duplicates.length > 0 && acknowledgedDupes
              ? 'Create anyway'
              : 'Create Job Application'}
        </Button>

      </form>
    </FormProvider>
  )
}
