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

export async function discoverAts(profileId: string, website: string): Promise<AtsDiscoveryResult> {
  const base = website.replace(/\/$/, '')
  const candidates = [`${base}/careers`, `${base}/jobs`]

  let html = ''
  for (const url of candidates) {
    if (!isSafePublicUrl(url)) continue
    try {
      const res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      })
      if (res.ok) {
        html = await res.text()
        break
      }
    } catch {
      continue
    }
  }

  if (!html) return FAILED_DISCOVERY

  const truncated = html.slice(0, 8_000)

  const prompt = `Analyze this HTML from a company careers page and identify their ATS (Applicant Tracking System).

Look for:
- Greenhouse: scripts from boards.greenhouse.io, "gh_jid" parameters, greenhouse embed scripts
- Lever: jobs.lever.co links or lever.co in scripts
- Ashby: jobs.ashbyhq.com links or ashbyhq.com in scripts

Extract the board/company slug (e.g. "mongodb" from boards.greenhouse.io/mongodb).

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
