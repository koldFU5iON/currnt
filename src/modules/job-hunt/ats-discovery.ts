// src/modules/job-hunt/ats-discovery.ts
import { completeStructured } from '@/modules/llm/client'
import { AtsDiscoveryResultSchema, type AtsDiscoveryResult } from './schema'

const FAILED_DISCOVERY: AtsDiscoveryResult = {
  provider: 'unknown',
  confidence: 0,
  reasoning: 'Could not fetch careers page',
}

export async function discoverAts(profileId: string, website: string): Promise<AtsDiscoveryResult> {
  const base = website.replace(/\/$/, '')
  const candidates = [`${base}/careers`, `${base}/jobs`]

  let html = ''
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
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
