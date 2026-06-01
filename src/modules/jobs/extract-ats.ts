import { td, decode, decodeEntities, CURRENCY_SYMBOLS, abbrevAmount, type ExtractedJob, type ExtractionResult } from './extract-utils'

// ── Site-specific Greenhouse overrides ──────────────────────────────────────
// Corporate SPAs that use Greenhouse but render client-side — we can't detect
// their embed script from SSR HTML, so we match the URL pattern directly.

interface SiteOverride {
  pattern: RegExp
  board: string
  jobId: (match: RegExpMatchArray) => string
}

const GREENHOUSE_SITE_OVERRIDES: SiteOverride[] = [
  {
    pattern: /stripe\.com\/jobs\/listing\/[^/]+\/(\d+)/i,
    board: 'stripe',
    jobId: m => m[1],
  },
]

export function matchSiteOverride(url: string): { board: string; jobId: string } | null {
  for (const override of GREENHOUSE_SITE_OVERRIDES) {
    const m = url.match(override.pattern)
    if (m) return { board: override.board, jobId: override.jobId(m) }
  }
  return null
}

// ── LinkedIn (/jobs/view/{id}) ───────────────────────────────────────────────

export function linkedInJobId(url: string): string | null {
  const m = url.match(/linkedin\.com\/jobs\/view\/(?:[^/]+-)?(\d+)/i)
  return m?.[1] ?? null
}

export async function extractLinkedIn(jobId: string): Promise<ExtractionResult> {
  const apiUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`
  let html: string
  try {
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      return { ok: false, error: `LinkedIn returned ${res.status} — the job may no longer be available.` }
    }
    html = await res.text()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: `Could not reach LinkedIn: ${msg}` }
  }

  const attr = (pattern: RegExp) => decode(html.match(pattern)?.[1]?.trim())
  const title = attr(/class="[^"]*topcard__title[^"]*"[^>]*>([^<]+)</)
    ?? attr(/<h2[^>]*class="[^"]*top-card-layout__title[^"]*"[^>]*>([^<]+)</)
  const company = attr(/class="[^"]*topcard__org-name-link[^"]*"[^>]*>\s*([^<\n]+)\s*<\/a>/i)
  const location = attr(/class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>\s*([^<\n]+)\s*<\//)
  const descHtml = attr(/class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]+?)<\/div>/)
  const jobDescription = descHtml ? td.turndown(descHtml) : undefined

  if (!title && !company && !jobDescription) {
    return { ok: false, error: 'Could not extract details from this LinkedIn job. Try copying the details manually.' }
  }
  return { ok: true, data: { title, company, location, jobDescription, jobNumber: jobId } }
}

// ── Greenhouse (public Boards API) ───────────────────────────────────────────

export function greenhouseFromUrl(url: string): { board: string; jobId: string } | null {
  const m = url.match(/(?:^|\/\/)(?:boards|job-boards)\.greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i)
  return m ? { board: m[1], jobId: m[2] } : null
}

export function greenhouseFromHtml(url: string, html: string): { board: string; jobId: string } | null {
  const board = html.match(/(?:boards|job-boards)\.greenhouse\.io\/embed\/job_board\/js\?for=([a-z0-9_-]+)/i)?.[1]
  if (!board) return null
  const jobId =
    url.match(/[?&]gh_jid=(\d+)/i)?.[1] ??
    html.match(/gh_jid=(\d+)/i)?.[1] ??
    url.match(/\/(?:jobs?|positions?)\/(\d+)/i)?.[1]
  return jobId ? { board, jobId } : null
}

export async function extractGreenhouse(board: string, jobId: string): Promise<ExtractionResult> {
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}?content=true`
  let payload: Record<string, unknown>
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      return { ok: false, error: `Greenhouse returned ${res.status} — the job may no longer be available.` }
    }
    payload = (await res.json()) as Record<string, unknown>
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: `Could not reach Greenhouse: ${msg}` }
  }

  const contentRaw = typeof payload.content === 'string' ? payload.content : ''
  const jobDescription = contentRaw ? td.turndown(decodeEntities(contentRaw)) : undefined
  const rawDate = typeof payload.first_published === 'string' ? payload.first_published : undefined
  const parsed = rawDate ? new Date(rawDate) : undefined
  const datePublished = parsed && !isNaN(parsed.getTime()) ? parsed : undefined
  const location = (payload.location as Record<string, unknown> | undefined)?.name
  const idValue = payload.id != null ? String(payload.id) : jobId

  return {
    ok: true,
    data: {
      title: decode(typeof payload.title === 'string' ? payload.title.trim() : undefined),
      company: decode(typeof payload.company_name === 'string' ? payload.company_name.trim() : undefined),
      location: decode(typeof location === 'string' ? location : undefined),
      jobDescription,
      jobNumber: idValue,
      datePublished,
    },
  }
}

// ── Lever (public Postings API) ──────────────────────────────────────────────

export function leverFromUrl(url: string): { company: string; jobId: string } | null {
  const m = url.match(/jobs\.lever\.co\/([^/?#]+)\/([a-f0-9-]{36})/i)
  return m ? { company: m[1], jobId: m[2] } : null
}

export async function extractLever(company: string, jobId: string): Promise<ExtractionResult> {
  const apiUrl = `https://api.lever.co/v0/postings/${company}/${jobId}?mode=json`
  let payload: Record<string, unknown>
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      return { ok: false, error: `Lever returned ${res.status} — the job may no longer be available.` }
    }
    payload = (await res.json()) as Record<string, unknown>
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: `Could not reach Lever: ${msg}` }
  }

  const categories = payload.categories as Record<string, unknown> | undefined
  const parts: string[] = []
  if (typeof payload.description === 'string' && payload.description) {
    parts.push(payload.description)
  }
  if (Array.isArray(payload.lists)) {
    for (const list of payload.lists as Array<Record<string, unknown>>) {
      if (typeof list.text === 'string' && typeof list.content === 'string') {
        parts.push(`<h3>${list.text}</h3>${list.content}`)
      }
    }
  }
  const jobDescription = parts.length > 0 ? td.turndown(parts.join('\n')) : undefined
  const salaryBand = formatLeverSalary(payload.salaryRange)

  return {
    ok: true,
    data: {
      title: decode(typeof payload.text === 'string' ? payload.text.trim() : undefined),
      location: decode(typeof categories?.location === 'string' ? categories.location : undefined),
      jobDescription,
      jobNumber: jobId,
      salaryBand,
    },
  }
}

function formatLeverSalary(salaryRange: unknown): string | undefined {
  if (!salaryRange || typeof salaryRange !== 'object') return undefined
  const s = salaryRange as Record<string, unknown>
  const curr = typeof s.currency === 'string' ? s.currency : 'USD'
  const sym = CURRENCY_SYMBOLS[curr] ?? (curr + ' ')
  const min = typeof s.min === 'number' ? s.min : null
  const max = typeof s.max === 'number' ? s.max : null
  if (min !== null && max !== null) return `${sym}${abbrevAmount(min)}–${abbrevAmount(max)}`
  if (min !== null) return `${sym}${abbrevAmount(min)}+`
  return undefined
}

// ── Ashby (public Posting API) ───────────────────────────────────────────────

export function ashbyFromUrl(url: string): { company: string; jobSlug: string } | null {
  const m = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)\/([^/?#]+)/i)
  return m ? { company: m[1], jobSlug: m[2] } : null
}

export async function extractAshby(company: string, jobSlug: string): Promise<ExtractionResult> {
  const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${company}/posting/${jobSlug}`
  let payload: Record<string, unknown>
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      return { ok: false, error: `Ashby returned ${res.status} — the job may no longer be available.` }
    }
    payload = (await res.json()) as Record<string, unknown>
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: `Could not reach Ashby: ${msg}` }
  }

  const jobDescription = typeof payload.descriptionHtml === 'string' && payload.descriptionHtml
    ? td.turndown(payload.descriptionHtml)
    : undefined
  const location = payload.isRemote === true
    ? 'Remote'
    : typeof payload.locationName === 'string' ? payload.locationName : undefined
  const rawDate = typeof payload.publishedDate === 'string' ? payload.publishedDate : undefined
  const parsed = rawDate ? new Date(rawDate) : undefined
  const datePublished = parsed && !isNaN(parsed.getTime()) ? parsed : undefined
  const comp = payload.compensation as Record<string, unknown> | undefined
  const salaryBand = typeof comp?.compensationTierSummary === 'string'
    ? comp.compensationTierSummary
    : undefined

  return {
    ok: true,
    data: {
      title: decode(typeof payload.title === 'string' ? payload.title.trim() : undefined),
      location: decode(location),
      jobDescription,
      jobNumber: typeof payload.id === 'string' ? payload.id : undefined,
      datePublished,
      salaryBand,
    },
  }
}

// ── Workday (internal API, best-effort) ──────────────────────────────────────
// Workday URLs: {tenant}.wd{N}.myworkdayjobs.com/en-US/{group}/job/{jobId}/{slug}
// The API is undocumented — returns null on any failure to fall through to tier 2.

export function workdayFromUrl(url: string): { subdomain: string; tenant: string; group: string; jobId: string } | null {
  const hostnameMatch = url.match(/^https?:\/\/(([a-z0-9-]+)\.wd\d+)\.myworkdayjobs\.com/i)
  if (!hostnameMatch) return null
  const subdomain = hostnameMatch[1]
  const tenant = hostnameMatch[2]
  const pathMatch = url.match(/\/([A-Za-z0-9_-]+)\/job\/([A-Za-z0-9_-]+)/i)
  if (!pathMatch) return null
  return { subdomain, tenant, group: pathMatch[1], jobId: pathMatch[2] }
}

export async function extractWorkday(
  subdomain: string,
  tenant: string,
  group: string,
  jobId: string,
): Promise<ExtractionResult | null> {
  const apiUrl = `https://${subdomain}.myworkdayjobs.com/wday/cxs/${tenant}/${group}/jobs/${jobId}`
  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const payload = (await res.json()) as Record<string, unknown>
    const postings = Array.isArray(payload.jobPostings) ? payload.jobPostings : []
    const job = postings[0] as Record<string, unknown> | undefined
    if (!job) return null

    const jobDescription = typeof job.jobDescription === 'string' && job.jobDescription
      ? td.turndown(job.jobDescription)
      : undefined

    return {
      ok: true,
      data: {
        title: decode(typeof job.title === 'string' ? job.title.trim() : undefined),
        location: decode(typeof job.locationsText === 'string' ? job.locationsText.trim() : undefined),
        jobDescription,
        jobNumber: typeof job.externalPath === 'string' ? job.externalPath : undefined,
      },
    }
  } catch {
    return null
  }
}
