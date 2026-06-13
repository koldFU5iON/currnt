import type { BoardJobListing, JobHuntSearchCriteria } from '../board-sources/schema'

export function isAvailable(): boolean {
  return true
}

export async function fetchJobs(criteria: JobHuntSearchCriteria): Promise<BoardJobListing[]> {
  const tags = criteria.roles.map((r) => r.toLowerCase().replace(/\s+/g, '-')).join(',')
  const url = `https://remoteok.com/api?tags=${encodeURIComponent(tags)}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'currnt-job-hunt/1.0' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`RemoteOK returned ${res.status}`)
  const data = (await res.json()) as unknown[]
  // First element is a metadata object — skip it
  return data.slice(1).map((j) => {
    const job = j as Record<string, unknown>
    const salaryMin = typeof job.salary_min === 'number' ? job.salary_min : null
    const salaryMax = typeof job.salary_max === 'number' ? job.salary_max : null
    const salary = salaryMin
      ? salaryMax && salaryMax !== salaryMin
        ? `$${salaryMin.toLocaleString()} – $${salaryMax.toLocaleString()}`
        : `$${salaryMin.toLocaleString()}`
      : null
    const rawDate = typeof job.date === 'string' ? job.date : null
    const parsed = rawDate ? new Date(rawDate) : null
    const loc = typeof job.location === 'string' ? job.location.trim() : null
    return {
      externalId: String(job.id ?? ''),
      title: String(job.position ?? ''),
      company: String(job.company ?? ''),
      location: loc || null,
      url: (typeof job.url === 'string' ? job.url : null) || null,
      postedAt: parsed && !isNaN(parsed.getTime()) ? parsed : null,
      salary,
    }
  })
}
