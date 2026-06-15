import type { JobListing } from '../schema'

type BambooJob = {
  id: string | number
  title: string
  status: string
  location?: {
    city?: string
    state?: string
    country?: string
    isRemote?: boolean
  }
}

export async function fetchJobList(companySlug: string): Promise<JobListing[]> {
  const res = await fetch(`https://${companySlug}.bamboohr.com/careers/list`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`BambooHR returned ${res.status}`)
  const data = (await res.json()) as BambooJob[]
  return data
    .filter((j) => j.status === 'Open')
    .map((j) => {
      const loc = j.location
      const parts = [loc?.city, loc?.state, loc?.country].filter(Boolean)
      const locationStr = loc?.isRemote ? 'Remote' : parts.join(', ') || null
      return {
        externalId: String(j.id),
        title: j.title,
        location: locationStr,
        url: `https://${companySlug}.bamboohr.com/careers/${j.id}`,
        postedAt: null,
      }
    })
}

export async function fetchDescription(_companySlug: string, _jobId: string): Promise<string | null> {
  return null
}
