'use client'

import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, FormProvider } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { FormField } from './form-field'
import { createJobSchema } from '@/modules/jobs/schema'
import { createJobApplication } from '@/modules/jobs/mutations'
import { extractJobFromUrl } from '@/modules/jobs/extract'
import { findPotentialDuplicates } from '@/modules/jobs/dedup'
import { type DuplicateMatch } from '@/modules/jobs/dedup-internal'
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
      salaryBand: '',
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
      if (data.salaryBand) form.setValue('salaryBand', data.salaryBand)
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

        <Controller
          name="url"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Job URL</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  {...field}
                  type="url"
                  placeholder="https://company.com/jobs/123"
                  aria-invalid={fieldState.invalid}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    onClick={handleExtract}
                    disabled={extracting}
                    className="gap-1"
                  >
                    {extracting
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Sparkles size={12} />}
                    {extracting ? 'Extracting…' : 'Extract'}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

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
          <FormField name="salaryBand" label="Salary Band" placeholder="e.g. $120k–$160k" />
        </div>

        <FormField
          name="applicationSource"
          label="Source"
          type="select"
          options={SOURCE_OPTIONS}
        />

        <FormField
          name="jobDescription"
          label="Job Description"
          type="textarea"
          placeholder="Paste or extract the full job description (markdown supported)"
        />

        {/* Sticky on mobile so the submit button stays reachable while scrolling the long textarea */}
        <div className="sticky bottom-0 -mx-6 -mb-6 px-6 pb-6 pt-3 bg-muted/95 backdrop-blur-sm border-t border-border/40 rounded-b-2xl md:static md:mx-0 md:mb-0 md:px-0 md:pt-0 md:pb-0 md:bg-transparent md:backdrop-blur-none md:border-0 md:rounded-none">
          <DuplicateWarning matches={duplicates} />
          <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
            {form.formState.isSubmitting
              ? 'Creating…'
              : duplicates.length > 0 && acknowledgedDupes
                ? 'Create anyway'
                : 'Create Job Application'}
          </Button>
        </div>

      </form>
    </FormProvider>
  )
}
