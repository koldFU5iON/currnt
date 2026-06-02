'use server'

import type { ExtractionResult, ExtractedJob } from './extract-utils'
import { decode, td, formatSalaryBand } from './extract-utils'
import {
  linkedInJobId, extractLinkedIn,
  greenhouseFromUrl, greenhouseFromHtml, extractGreenhouse,
  matchSiteOverride,
  leverFromUrl, extractLever,
  ashbyFromUrl, extractAshby,
  workdayFromUrl, extractWorkday,
} from './extract-ats'
import { lookup as dnsLookup } from 'dns/promises'
import { extractWithLLM } from './extract-llm'

// ── SSRF guard ────────────────────────────────────────────────────────────────
// Three-layer defence: scheme check → hostname/IP blocklist → DNS resolution.
// DNS resolution catches rebinding attacks and alternate IP encodings (e.g.
// decimal 2130706433 → 127.0.0.1) that bypass pure string matching.
// The post-fetch redirect check (res.url) closes the redirect-hop gap.

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    // Bare IPv6 (brackets already stripped by caller)
    const h = ip.toLowerCase()
    return (
      h === '::1' || h === '::' ||
      h.startsWith('fc') || h.startsWith('fd') ||   // ULA fc00::/7
      h.startsWith('fe80') ||                        // link-local fe80::/10
      h.startsWith('::ffff:127.') ||                 // IPv4-mapped loopback
      h.startsWith('::ffff:10.') ||                  // IPv4-mapped RFC-1918
      h.startsWith('::ffff:192.168.') ||
      /^::ffff:172\.(1[6-9]|2[0-9]|3[01])\./.test(h)
    )
  }
  return (
    ip === '0.0.0.0' ||
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip) ||
    /^169\.254\./.test(ip)
  )
}

function isSafeHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  // URL.hostname wraps IPv6 literals in brackets — strip them before IP check
  const bare = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h
  if (bare.includes(':')) return !isPrivateIp(bare)   // IPv6 literal in URL
  return !(
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h === 'metadata.google.internal' ||
    isPrivateIp(h)
  )
}

async function isSafeUrl(raw: string): Promise<boolean> {
  let parsed: URL
  try { parsed = new URL(raw) } catch { return false }
  if (parsed.protocol !== 'https:') return false
  if (!isSafeHostname(parsed.hostname)) return false
  // DNS resolution: normalises alternate encodings and catches rebinding
  try {
    const addrs = await dnsLookup(parsed.hostname, { all: true })
    return !addrs.some(a => isPrivateIp(a.address))
  } catch {
    return false   // unresolvable hostname → reject
  }
}

export async function extractJobFromUrl(url: string): Promise<ExtractionResult> {
  if (!(await isSafeUrl(url))) {
    return { ok: false, error: 'Invalid URL — only public HTTPS job pages are supported.' }
  }

  // ── Tier 1: ATS routing (no HTML fetch) ──────────────────────────────────
  const linkedInId = linkedInJobId(url)
  if (linkedInId) return extractLinkedIn(linkedInId)

  const siteOverride = matchSiteOverride(url)
  if (siteOverride) return extractGreenhouse(siteOverride.board, siteOverride.jobId)

  const directGh = greenhouseFromUrl(url)
  if (directGh) return extractGreenhouse(directGh.board, directGh.jobId)

  const lever = leverFromUrl(url)
  if (lever) return extractLever(lever.company, lever.jobId)

  const ashby = ashbyFromUrl(url)
  if (ashby) return extractAshby(ashby.company, ashby.jobSlug)

  const workday = workdayFromUrl(url)
  if (workday) {
    const result = await extractWorkday(workday.subdomain, workday.tenant, workday.group, workday.jobId)
    if (result) return result
    // null = API unavailable, fall through to HTML fetch
  }

  // ── Tier 2: HTML fetch + structural parse ─────────────────────────────────
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
    // Re-check the final URL after any redirects to block redirect-hop SSRF
    try {
      if (!isSafeHostname(new URL(res.url).hostname)) {
        return { ok: false, error: 'Invalid URL — only public HTTPS job pages are supported.' }
      }
    } catch { /* unparseable final URL — proceed */ }
    if (!res.ok) {
      return {
        ok: false,
        error: `Could not reach that page — it may block automated access (${res.status}). Try pasting the details manually.`,
      }
    }
    html = await res.text()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: `Could not reach that URL: ${msg}` }
  }

  const embeddedGh = greenhouseFromHtml(url, html)
  if (embeddedGh) {
    const ghResult = await extractGreenhouse(embeddedGh.board, embeddedGh.jobId)
    if (ghResult.ok) return ghResult
  }

  const extracted = fromJsonLd(html) ?? fromMetaTags(html)
  if (extracted.title || extracted.company || extracted.jobDescription) {
    return { ok: true, data: extracted }
  }

  // ── Tier 3: LLM extraction ────────────────────────────────────────────────
  return extractWithLLM(html)
}

// ── JSON-LD JobPosting ────────────────────────────────────────────────────────

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
        salaryBand: formatSalaryBand(job.baseSalary),
      }
    } catch {
      // malformed block — try the next one
    }
  }
  return null
}

// ── OpenGraph / meta fallback ─────────────────────────────────────────────────

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
