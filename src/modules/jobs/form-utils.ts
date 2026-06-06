import type { ExtractedJob } from './extract-utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyExtractedData(form: { setValue: (name: any, value: any, options?: any) => void }, data: ExtractedJob) {
  if (data.title)          form.setValue('title', data.title, { shouldValidate: true })
  if (data.company)        form.setValue('company', data.company, { shouldValidate: true })
  if (data.location)       form.setValue('location', data.location)
  if (data.jobDescription) form.setValue('jobDescription', data.jobDescription)
  if (data.jobNumber)      form.setValue('jobNumber', data.jobNumber)
  if (data.salaryBand)     form.setValue('salaryBand', data.salaryBand)
  if (data.datePublished)  form.setValue('datePublished', data.datePublished)
}
