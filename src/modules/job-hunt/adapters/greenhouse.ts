import type { JobListing } from '../schema'
import { extractGreenhouse } from '@/modules/jobs/extract-ats'

export async function fetchJobList(boardSlug: string): Promise<JobListing[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardSlug}/jobs`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Greenhouse returned ${res.status}`)
  const data = (await res.json()) as { jobs: unknown[] }
  return (data.jobs ?? []).map((j) => {
    const job = j as Record<string, unknown>
    const loc = (job.location as Record<string, unknown> | undefined)?.name
    const rawDate = typeof job.first_published === 'string' ? job.first_published : null
    const parsed = rawDate ? new Date(rawDate) : null
    return {
      externalId: String(job.id ?? ''),
      title: String(job.title ?? ''),
      location: typeof loc === 'string' ? loc : null,
      url: typeof job.absolute_url === 'string' ? job.absolute_url : null,
      postedAt: parsed && !isNaN(parsed.getTime()) ? parsed : null,
    }
  })
}

export async function fetchDescription(boardSlug: string, jobId: string): Promise<string | null> {
  const result = await extractGreenhouse(boardSlug, jobId)
  return result.ok ? (result.data.jobDescription ?? null) : null
}
