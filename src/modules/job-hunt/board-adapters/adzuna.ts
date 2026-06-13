import type { BoardJobListing } from '../board-sources/schema'
import type { JobHuntSearchCriteria } from '../board-sources/schema'

const COUNTRY_MAP: Record<string, string> = {
  ireland: 'ie',
  'united kingdom': 'gb',
  uk: 'gb',
  france: 'fr',
  'united states': 'us',
  usa: 'us',
  canada: 'ca',
  australia: 'au',
  germany: 'de',
  netherlands: 'nl',
}

export function locationToCountryCode(location: string): string {
  const key = location.toLowerCase().trim()
  return COUNTRY_MAP[key] ?? 'us'
}

export function isAvailable(): boolean {
  return !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)
}

function datePostedToDays(datePosted: JobHuntSearchCriteria['datePosted']): number | null {
  if (datePosted === 'last7') return 7
  if (datePosted === 'last30') return 30
  if (datePosted === 'last90') return 90
  return null
}

async function fetchForCountry(
  countryCode: string,
  role: string,
  criteria: JobHuntSearchCriteria,
): Promise<Array<{ countryCode: string; raw: Record<string, unknown> }>> {
  const appId = process.env.ADZUNA_APP_ID!
  const appKey = process.env.ADZUNA_APP_KEY!
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: '50',
    what: role,
    content_type: 'application/json',
  })
  const days = datePostedToDays(criteria.datePosted)
  if (days) params.set('max_days_old', String(days))
  if (criteria.minSalary) params.set('salary_min', String(criteria.minSalary))

  const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?${params}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Adzuna ${countryCode} returned ${res.status}`)
  const data = (await res.json()) as { results: unknown[] }
  return (data.results ?? []).map((r) => ({
    countryCode,
    raw: r as Record<string, unknown>,
  }))
}

function formatSalary(min: number | null, max: number | null, countryCode: string): string | null {
  if (!min) return null
  const symbol = countryCode === 'ie' || countryCode === 'fr' ? '€' : '£'
  if (max && max !== min) {
    return `${symbol}${min.toLocaleString()} – ${symbol}${max.toLocaleString()}`
  }
  return `${symbol}${min.toLocaleString()}`
}

export async function fetchJobs(criteria: JobHuntSearchCriteria): Promise<BoardJobListing[]> {
  // Derive unique country codes from location list; fall back to 'us' if empty
  const locations = criteria.locations.length ? criteria.locations : ['Remote']
  const countryCodes = [...new Set(locations.map(locationToCountryCode))]

  const results: BoardJobListing[] = []

  for (const role of criteria.roles) {
    const settled = await Promise.allSettled(
      countryCodes.map((cc) => fetchForCountry(cc, role, criteria)),
    )
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i]
      if (result.status === 'rejected') continue
      const cc = countryCodes[i]
      for (const { raw } of result.value) {
        const company = (raw.company as Record<string, unknown> | undefined)?.display_name
        const location = (raw.location as Record<string, unknown> | undefined)?.display_name
        const rawDate = typeof raw.created === 'string' ? raw.created : null
        const parsed = rawDate ? new Date(rawDate) : null
        const salaryMin = typeof raw.salary_min === 'number' ? raw.salary_min : null
        const salaryMax = typeof raw.salary_max === 'number' ? raw.salary_max : null
        results.push({
          externalId: `${cc}-${String(raw.id ?? '')}`,
          title: String(raw.title ?? ''),
          company: typeof company === 'string' ? company : '',
          location: typeof location === 'string' ? location : null,
          url: typeof raw.redirect_url === 'string' ? raw.redirect_url || null : null,
          postedAt: parsed && !isNaN(parsed.getTime()) ? parsed : null,
          salary: formatSalary(salaryMin, salaryMax, cc),
        })
      }
    }
  }

  return results
}
