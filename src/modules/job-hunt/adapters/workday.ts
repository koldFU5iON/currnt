import type { JobListing } from '../schema'

// boardSlug format: "{subdomain}/{board}", e.g. "logitech.wd5/Logitech"
// subdomain = company + datacenter, e.g. "logitech.wd5"
// board     = path segment on the career site, e.g. "Logitech"
function parseSlug(boardSlug: string) {
  const idx = boardSlug.indexOf('/')
  if (idx === -1) throw new Error(`Invalid Workday boardSlug: ${boardSlug}`)
  const subdomain = boardSlug.slice(0, idx)
  const board = boardSlug.slice(idx + 1)
  const company = subdomain.split('.')[0]
  return { subdomain, company, board }
}

// Workday returns human strings like "Posted 5 Days Ago" or "Posted 30+ Days Ago".
function parsePostedOn(postedOn: string): Date | null {
  if (!postedOn) return null
  if (/today/i.test(postedOn)) return new Date()
  const m = postedOn.match(/(\d+)\+?\s*days?\s*ago/i)
  if (!m) return null
  const d = new Date()
  d.setDate(d.getDate() - parseInt(m[1], 10))
  return d
}

export async function fetchJobList(boardSlug: string): Promise<JobListing[]> {
  const { subdomain, company, board } = parseSlug(boardSlug)
  const url = `https://${subdomain}.myworkdayjobs.com/wday/cxs/${company}/${board}/jobs`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ appliedFacets: {}, limit: 100, offset: 0, searchText: '' }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) throw new Error(`Workday returned ${res.status}`)

  const data = (await res.json()) as { jobPostings?: unknown[] }
  const host = `https://${subdomain}.myworkdayjobs.com`

  return (data.jobPostings ?? [])
    .map((j) => {
      const job = j as Record<string, unknown>
      const externalPath = typeof job.externalPath === 'string' ? job.externalPath : ''
      return {
        externalId: externalPath,
        title: String(job.title ?? ''),
        location: typeof job.locationsText === 'string' ? job.locationsText : null,
        url: externalPath ? `${host}${externalPath}` : null,
        postedAt: typeof job.postedOn === 'string' ? parsePostedOn(job.postedOn) : null,
      }
    })
    .filter((j) => j.externalId !== '')
}

export async function fetchDescription(boardSlug: string, externalPath: string): Promise<string | null> {
  const { subdomain, company, board } = parseSlug(boardSlug)

  // externalPath: "/{board}/job/{location}/{title}_{id}"
  // Strip the /{board} prefix to get the job-specific path for the API.
  const boardPrefix = `/${board}/`
  const jobPath = externalPath.startsWith(boardPrefix)
    ? externalPath.slice(boardPrefix.length - 1)  // preserves leading slash: /job/...
    : externalPath

  const url = `https://${subdomain}.myworkdayjobs.com/wday/cxs/${company}/${board}${jobPath}`

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null

  const data = (await res.json()) as Record<string, unknown>
  const info = data.jobPostingInfo as Record<string, unknown> | undefined
  return typeof info?.jobDescription === 'string' ? info.jobDescription : null
}
