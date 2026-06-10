import type { JobListing } from '../schema'
import { extractAshby } from '@/modules/jobs/extract-ats'

export async function fetchJobList(companySlug: string): Promise<JobListing[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${companySlug}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Ashby returned ${res.status}`)
  const data = (await res.json()) as { jobPostings: unknown[] }
  return (data.jobPostings ?? [])
    .filter((j) => (j as Record<string, unknown>).jobPostingState === 'Published')
    .map((j) => {
      const job = j as Record<string, unknown>
      const location = job.isRemote === true
        ? 'Remote'
        : typeof job.locationName === 'string' ? job.locationName : null
      const rawDate = typeof job.publishedDate === 'string' ? job.publishedDate : null
      const parsed = rawDate ? new Date(rawDate) : null
      return {
        externalId: String(job.id ?? ''),
        title: String(job.title ?? ''),
        location,
        url: typeof job.externalLink === 'string' ? job.externalLink : '',
        postedAt: parsed && !isNaN(parsed.getTime()) ? parsed : null,
      }
    })
}

export async function fetchDescription(companySlug: string, jobSlug: string): Promise<string | null> {
  const result = await extractAshby(companySlug, jobSlug)
  return result.ok ? (result.data.jobDescription ?? null) : null
}
