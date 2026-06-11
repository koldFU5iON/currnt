// src/modules/job-hunt/ats-discovery.ts
import { completeStructured } from '@/modules/llm/client'
import { AtsDiscoveryResultSchema, type AtsDiscoveryResult } from './schema'

const FAILED_DISCOVERY: AtsDiscoveryResult = {
  provider: 'unknown',
  confidence: 0,
  reasoning: 'Could not fetch careers page',
}

function isSafePublicUrl(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  const host = parsed.hostname.toLowerCase()
  // Reject bare IPv4/IPv6 literals
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false
  if (host.startsWith('[')) return false
  // Reject localhost and common internal hostnames
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) return false
  return true
}

// Fetches a URL with one validated redirect hop — prevents SSRF via open redirects
// while still working for careers pages that redirect to their ATS board.
async function fetchHtml(url: string): Promise<string | null> {
  if (!isSafePublicUrl(url)) return null
  const res = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
  })
  if (res.ok) return res.text()
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')
    if (!location) return null
    const redirectUrl = new URL(location, url).toString()
    if (!isSafePublicUrl(redirectUrl)) return null
    const res2 = await fetch(redirectUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    })
    return res2.ok ? res2.text() : null
  }
  return null
}

// Regex-based ATS detection from HTML source — skips LLM for clear-cut cases.
function detectAtsFromHtml(html: string): AtsDiscoveryResult | null {
  // Greenhouse embed: greenhouse.io/embed/...?for=SLUG (covers both board and job-app embeds)
  const ghEmbed = html.match(/greenhouse\.io\/embed\/[^?"']*\?[^"']*for=([a-zA-Z0-9_-]+)/i)
  if (ghEmbed) return {
    provider: 'greenhouse',
    boardSlug: ghEmbed[1],
    confidence: 0.95,
    reasoning: 'Greenhouse embed URL detected in page source',
  }

  // Greenhouse board URL: boards.greenhouse.io/SLUG (excluding /embed sub-paths)
  const ghBoard = html.match(/(?:boards|job-boards)\.greenhouse\.io\/(?!embed\b)([a-zA-Z0-9_-]+)/i)
  if (ghBoard) return {
    provider: 'greenhouse',
    boardSlug: ghBoard[1],
    confidence: 0.9,
    reasoning: 'Greenhouse board URL found in page source',
  }

  // Lever
  const lv = html.match(/jobs\.lever\.co\/([a-zA-Z0-9_-]+)/i)
  if (lv) return {
    provider: 'lever',
    boardSlug: lv[1],
    confidence: 0.9,
    reasoning: 'Lever board URL found in page source',
  }

  // Ashby
  const ash = html.match(/jobs\.ashbyhq\.com\/([a-zA-Z0-9_-]+)/i)
  if (ash) return {
    provider: 'ashby',
    boardSlug: ash[1],
    confidence: 0.9,
    reasoning: 'Ashby board URL found in page source',
  }

  // SuccessFactors: any subdomain of successfactors.com or sapsf.com with company= param
  const sf = html.match(/(?:successfactors|sapsf)\.com[^"']*[?&]company=([a-zA-Z0-9_-]+)/i)
  if (sf) return {
    provider: 'successfactors',
    boardSlug: sf[1],
    confidence: 0.9,
    reasoning: 'SAP SuccessFactors career portal URL found in page source',
  }

  // Workday: {company}.{datacenter}.myworkdayjobs.com/{BoardName}
  const wd = html.match(/([a-zA-Z0-9-]+\.[a-zA-Z0-9]+)\.myworkdayjobs\.com\/([a-zA-Z0-9_-]+)/i)
  if (wd) return {
    provider: 'workday',
    boardSlug: `${wd[1].toLowerCase()}/${wd[2]}`,
    confidence: 0.9,
    reasoning: 'Workday career portal URL found in page source',
  }

  return null
}

export async function discoverAts(profileId: string, website: string): Promise<AtsDiscoveryResult> {
  let origin: string
  try {
    origin = new URL(website).origin
  } catch {
    return FAILED_DISCOVERY
  }

  // Try the URL itself first — a specific job or careers page often embeds ATS scripts
  // in its own HTML. Then fall back to the site root and common careers paths.
  // Using origin (not the full path) for the /careers and /jobs suffixes.
  const candidates = [...new Set([
    website,
    origin,
    `${origin}/careers`,
    `${origin}/jobs`,
  ])]

  let html = ''
  for (const url of candidates) {
    try {
      const fetched = await fetchHtml(url)
      if (fetched) {
        html = fetched
        break
      }
    } catch {
      continue
    }
  }

  if (!html) return FAILED_DISCOVERY

  // Try regex detection before calling the LLM — faster, cheaper, more reliable
  // for pages that include recognizable ATS embed scripts or board URLs.
  const regexResult = detectAtsFromHtml(html)
  if (regexResult) return regexResult

  const truncated = html.slice(0, 8_000)

  const prompt = `Analyze this HTML from a company careers page and identify their ATS (Applicant Tracking System).

Look for:
- Greenhouse: scripts from boards.greenhouse.io, "gh_jid" parameters, greenhouse embed scripts
- Lever: jobs.lever.co links or lever.co in scripts
- Ashby: jobs.ashbyhq.com links or ashbyhq.com in scripts
- SAP SuccessFactors: links or scripts referencing successfactors.com or sapsf.com with a company= parameter
- Workday: links to {company}.{datacenter}.myworkdayjobs.com/{BoardName}

Extract the board/company slug (e.g. "mongodb" from boards.greenhouse.io/mongodb, "bentleyprod" from successfactors.com/careers?company=bentleyprod, or "logitech.wd5/Logitech" from logitech.wd5.myworkdayjobs.com/Logitech).

HTML:
\`\`\`
${truncated}
\`\`\`

Return provider, boardSlug, careersUrl, confidence (0–1), and brief reasoning.`

  const result = await completeStructured(profileId, prompt, AtsDiscoveryResultSchema, {
    maxOutputTokens: 300,
    temperature: 0,
    feature: 'job-hunt-ats-discovery',
  })

  return result.object
}
