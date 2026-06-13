import type { BoardJobListing, JobHuntSearchCriteria } from '../board-sources/schema'

export function isAvailable(): boolean {
  return true
}

export async function fetchJobs(criteria: JobHuntSearchCriteria): Promise<BoardJobListing[]> {
  const query = criteria.roles.join(',')
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=50`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Remotive returned ${res.status}`)
  const data = (await res.json()) as { jobs: unknown[] }
  return (data.jobs ?? []).map((j) => {
    const job = j as Record<string, unknown>
    const rawSalary = typeof job.salary === 'string' ? job.salary.trim() : null
    const rawDate = typeof job.publication_date === 'string' ? job.publication_date : null
    const parsed = rawDate ? new Date(rawDate) : null
    return {
      externalId: String(job.id ?? ''),
      title: String(job.title ?? ''),
      company: String(job.company_name ?? ''),
      location: typeof job.candidate_required_location === 'string'
        ? job.candidate_required_location || null
        : null,
      url: String(job.url ?? '') || null,
      postedAt: parsed && !isNaN(parsed.getTime()) ? parsed : null,
      salary: rawSalary || null,
    }
  })
}
