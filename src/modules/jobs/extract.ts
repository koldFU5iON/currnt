'use server'

import TurndownService from 'turndown'

const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' })
td.remove(['script', 'style', 'noscript'])

export type ExtractedJob = {
  title?: string
  company?: string
  location?: string
  jobDescription?: string
  jobNumber?: string
  datePublished?: Date
}

type ExtractionResult =
  | { ok: true; data: ExtractedJob }
  | { ok: false; error: string }

export async function extractJobFromUrl(url: string): Promise<ExtractionResult> {
  const linkedInId = linkedInJobId(url)
  if (linkedInId) return extractLinkedIn(linkedInId)

  // Direct Greenhouse URL — call the API without fetching the wrapper page
  const directGh = greenhouseFromUrl(url)
  if (directGh) return extractGreenhouse(directGh.board, directGh.jobId)

  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      return { ok: false, error: `Page returned ${res.status} — the URL may require a login or no longer exists.` }
    }
    html = await res.text()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: `Could not reach that URL: ${msg}` }
  }

  // Greenhouse embedded on a wrapper site (e.g. mongodb.com/careers, many corporate sites)
  const embeddedGh = greenhouseFromHtml(url, html)
  if (embeddedGh) {
    const ghResult = await extractGreenhouse(embeddedGh.board, embeddedGh.jobId)
    if (ghResult.ok) return ghResult
    // If the API didn't have the job, fall through to JSON-LD / meta below
  }

  const extracted = fromJsonLd(html) ?? fromMetaTags(html)

  if (!extracted.title && !extracted.company && !extracted.jobDescription) {
    return {
      ok: false,
      error: 'No job details found on that page. The site may block automated access — try pasting the details manually.',
    }
  }

  return { ok: true, data: extracted }
}

// ── LinkedIn (/jobs/view/{id}) — uses the crawler-friendly guest API ──────────

function linkedInJobId(url: string): string | null {
  const m = url.match(/linkedin\.com\/jobs\/view\/(?:[^/]+-)?(\d+)/i)
  return m?.[1] ?? null
}

async function extractLinkedIn(jobId: string): Promise<ExtractionResult> {
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

  // company name sits inside the org-name link
  const company = attr(/class="[^"]*topcard__org-name-link[^"]*"[^>]*>\s*([^<\n]+)\s*<\/a>/i)

  // first topcard__flavor--bullet is always the location
  const location = attr(/class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>\s*([^<\n]+)\s*<\//)

  // job description lives in the show-more-less markup div
  const descHtml = attr(/class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]+?)<\/div>/)
  const jobDescription = descHtml ? td.turndown(descHtml) : undefined

  if (!title && !company && !jobDescription) {
    return {
      ok: false,
      error: 'Could not extract details from this LinkedIn job. Try copying the details manually.',
    }
  }

  return {
    ok: true,
    data: { title, company, location, jobDescription, jobNumber: jobId },
  }
}

// ── Greenhouse (public Boards API) ────────────────────────────────────────────
//
// Works for two cases:
//   1. Direct URLs like boards.greenhouse.io/{board}/jobs/{id}
//   2. Wrapper sites (e.g. mongodb.com/careers/jobs/{id}) that embed Greenhouse
//      via boards.greenhouse.io/embed/job_board/js?for={board}. The wrapper HTML
//      is just a shell — the job content is rendered client-side, so a server
//      fetch sees no description. Calling the API directly bypasses this.

function greenhouseFromUrl(url: string): { board: string; jobId: string } | null {
  const m = url.match(/(?:^|\/\/)(?:boards|job-boards)\.greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i)
  return m ? { board: m[1], jobId: m[2] } : null
}

function greenhouseFromHtml(url: string, html: string): { board: string; jobId: string } | null {
  const board = html.match(/(?:boards|job-boards)\.greenhouse\.io\/embed\/job_board\/js\?for=([a-z0-9_-]+)/i)?.[1]
  if (!board) return null

  // gh_jid is Greenhouse's canonical query param; many wrappers expose only the path id
  const jobId =
    url.match(/[?&]gh_jid=(\d+)/i)?.[1] ??
    html.match(/gh_jid=(\d+)/i)?.[1] ??
    url.match(/\/(?:jobs?|positions?)\/(\d+)/i)?.[1]

  return jobId ? { board, jobId } : null
}

async function extractGreenhouse(board: string, jobId: string): Promise<ExtractionResult> {
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

  // Greenhouse returns description HTML with entities encoded (&lt;p&gt;…),
  // so we must decode before handing it to Turndown or it'll render literally.
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

function decode(s: string | undefined): string | undefined {
  return s ? decodeEntities(s) : s
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&') // last, so e.g. &amp;lt; doesn't get over-decoded
}

// ── JSON-LD JobPosting (used by Lever, Workday, Indeed, and many ATSs) ────────

function fromJsonLd(html: string): ExtractedJob | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]

  for (const block of blocks) {
    try {
      const raw = JSON.parse(block[1])
      const candidates: unknown[] = Array.isArray(raw?.['@graph']) ? raw['@graph'] : [raw]
      const job = candidates.find(
        (c): c is Record<string, unknown> =>
          typeof c === 'object' && c !== null && (c as Record<string, unknown>)['@type'] === 'JobPosting',
      )
      if (!job) continue

      const addr = (job.jobLocation as Record<string, unknown> | undefined)?.address as Record<string, unknown> | undefined
      const city = addr?.addressLocality as string | undefined
      const country = addr?.addressCountry as string | undefined
      const isRemote = job.jobLocationType === 'TELECOMMUTE'

      const locationParts = isRemote
        ? ['Remote', city, country].filter(Boolean)
        : [city, country].filter(Boolean)

      const descHtml = (job.description as string | undefined) ?? ''
      const jobDescription = descHtml ? td.turndown(descHtml) : undefined

      const rawDate = job.datePosted as string | undefined
      const parsed = rawDate ? new Date(rawDate) : undefined
      const datePublished = parsed && !isNaN(parsed.getTime()) ? parsed : undefined

      const org = job.hiringOrganization as Record<string, unknown> | undefined
      const identifier = job.identifier as Record<string, unknown> | undefined

      return {
        title: decode((job.title as string | undefined)?.trim()),
        company: decode((org?.name as string | undefined)?.trim()),
        location: decode(locationParts.length > 0 ? (locationParts as string[]).join(', ') : undefined),
        jobDescription,
        jobNumber: identifier?.value != null ? String(identifier.value) : undefined,
        datePublished,
      }
    } catch {
      // malformed block — try the next one
    }
  }
  return null
}

// ── OpenGraph / meta fallback ──────────────────────────────────────────────────

function fromMetaTags(html: string): ExtractedJob {
  const og = (prop: string) => {
    const a = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
    const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'))
    return decode((a?.[1] ?? b?.[1])?.trim())
  }

  const title =
    og('og:title') ??
    decode(html.match(/<h1[^>]*>([^<]{3,120})<\/h1>/i)?.[1]?.trim()) ??
    decode(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s*[\|\-–]\s*.+$/, '').trim())

  return {
    title: title ?? undefined,
    jobDescription: og('og:description') ?? undefined,
  }
}
