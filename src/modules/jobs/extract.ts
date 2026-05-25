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

  const attr = (pattern: RegExp) => html.match(pattern)?.[1]?.trim()

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

// ── JSON-LD JobPosting (most reliable — used by Greenhouse, Lever, Workday, Indeed) ──

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
        title: (job.title as string | undefined)?.trim(),
        company: (org?.name as string | undefined)?.trim(),
        location: locationParts.length > 0 ? (locationParts as string[]).join(', ') : undefined,
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
    return (a?.[1] ?? b?.[1])?.trim()
  }

  const title =
    og('og:title') ??
    html.match(/<h1[^>]*>([^<]{3,120})<\/h1>/i)?.[1]?.trim() ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s*[\|\-–]\s*.+$/, '').trim()

  return {
    title: title ?? undefined,
    jobDescription: og('og:description') ?? undefined,
  }
}
