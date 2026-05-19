'use client'

import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { FormField } from './FormField'
import { createJobSchema } from '@/modules/jobs/schema'
import { createJobApplication } from '@/modules/jobs/mutations'
import { toast } from 'sonner'
import { redirect } from 'next/navigation'

export function CreateJobForm() {
  const form = useForm<z.infer<typeof createJobSchema>>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      title: '',
      company: '',
      url: '',
      jobDescription: '',
      jobNumber: '',
      jobPublished: new Date()
    },
  })

  async function onSubmit(data: z.infer<typeof createJobSchema>) {
    try {
      await createJobApplication(data)
      form.reset()
      // TODO: Show success message and redirect
      toast('New Job Application Created')
      redirect('/dashboard/job-application/')
    } catch (error) {
      console.error('Error creating job:', error)
      // TODO: Show error message
    }
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          name="title"
          label="Job Title"
          placeholder="e.g. Senior Product Manager"
          required
        />

        <FormField
          name="company"
          label="Company"
          placeholder="e.g. Google"
          required
        />

        <FormField
          name="url"
          label="Job URL"
          type="url"
          placeholder="https://example.com/jobs/123"
        />

        <FormField
          name="jobNumber"
          label="Job Number (Optional)"
          placeholder="e.g. JOB-123"
        />

        <FormField
          name="jobDescription"
          label="Job Description"
        />

        <FormField
          name="jobPublished"
          label="Job Published"
          placeholder=''
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Creating...' : 'Create Job Application'}
        </Button>
        {Object.keys(form.formState.errors).length > 0 && (
          <pre className="text-red-500 text-xs">
            {JSON.stringify(form.formState.errors, null, 2)}
          </pre>
        )}
      </form>


    </FormProvider>
  )
}
