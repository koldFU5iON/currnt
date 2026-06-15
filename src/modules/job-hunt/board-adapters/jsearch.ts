import type { BoardJobListing, JobHuntSearchCriteria } from '../board-sources/schema'

export function isAvailable(apiKey: string | null): boolean {
  return !!apiKey
}

function datePostedToFilter(datePosted: JobHuntSearchCriteria['datePosted']): string {
  if (datePosted === 'last7') return 'week'
  if (datePosted === 'last30') return 'month'
  if (datePosted === 'last90') return 'month'
  return 'all'
}

async function fetchForQuery(
  query: string,
  apiKey: string,
  dateFilter: string,
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ query, date_posted: dateFilter, num_pages: '1' })
  const res = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status === 401 || res.status === 403) throw new Error('key_invalid')
  if (!res.ok) throw new Error(`JSearch returned ${res.status}`)
  const data = (await res.json()) as { data: unknown[] }
  return (data.data ?? []) as Record<string, unknown>[]
}

export async function fetchJobs(
  criteria: JobHuntSearchCriteria,
  apiKey: string,
): Promise<BoardJobListing[]> {
  const locations = criteria.locations.length ? criteria.locations : ['']
  const dateFilter = datePostedToFilter(criteria.datePosted)

  // Build one query per role, appending the first location (JSearch handles geo natively)
  const queries = criteria.roles.map((role) =>
    locations[0] ? `${role} in ${locations[0]}` : role,
  )

  const results: BoardJobListing[] = []
  const fetched = await Promise.all(
    queries.map((q) => fetchForQuery(q, apiKey, dateFilter)),
  )
  for (const result of fetched) {
    for (const raw of result) {
      const city = typeof raw.job_city === 'string' ? raw.job_city : null
      const country = typeof raw.job_country === 'string' ? raw.job_country : null
      const location = [city, country].filter(Boolean).join(', ') || null
      const rawDate = typeof raw.job_posted_at_datetime_utc === 'string'
        ? raw.job_posted_at_datetime_utc
        : null
      const parsed = rawDate ? new Date(rawDate) : null
      const salMin = typeof raw.job_min_salary === 'number' ? raw.job_min_salary : null
      const salMax = typeof raw.job_max_salary === 'number' ? raw.job_max_salary : null
      const salary = salMin
        ? salMax && salMax !== salMin
          ? `$${salMin.toLocaleString()} – $${salMax.toLocaleString()}`
          : `$${salMin.toLocaleString()}`
        : null
      results.push({
        externalId: String(raw.job_id ?? ''),
        title: String(raw.job_title ?? ''),
        company: String(raw.employer_name ?? ''),
        location,
        url: typeof raw.job_apply_link === 'string' ? raw.job_apply_link || null : null,
        postedAt: parsed && !isNaN(parsed.getTime()) ? parsed : null,
        salary,
      })
    }
  }
  return results
}
