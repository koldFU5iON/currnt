import type { JobListing } from '../schema'
import { extractLever } from '@/modules/jobs/extract-ats'

export async function fetchJobList(companySlug: string): Promise<JobListing[]> {
  const url = `https://api.lever.co/v0/postings/${companySlug}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Lever returned ${res.status}`)
  const data = (await res.json()) as unknown[]
  return data.map((j) => {
    const job = j as Record<string, unknown>
    const categories = job.categories as Record<string, unknown> | undefined
    const ts = typeof job.createdAt === 'number' ? job.createdAt : null
    return {
      externalId: String(job.id ?? ''),
      title: String(job.text ?? ''),
      location: typeof categories?.location === 'string' ? categories.location : null,
      url: typeof job.hostedUrl === 'string' ? job.hostedUrl : '',
      postedAt: ts ? new Date(ts) : null,
    }
  })
}

export async function fetchDescription(companySlug: string, jobId: string): Promise<string | null> {
  const result = await extractLever(companySlug, jobId)
  return result.ok ? (result.data.jobDescription ?? null) : null
}
