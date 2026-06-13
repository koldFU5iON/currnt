const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'mc_cid', 'mc_eid', 'hsCtaTracking', '_hsenc', '_hsmi', 'mkt_tok',
])

const ATS_PARAMS = new Set(['gh_jid', 'lever-origin'])

export function cleanJobUrl(raw: string): string {
  let parsed: URL
  try { parsed = new URL(raw) } catch { return raw }

  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key) && !ATS_PARAMS.has(key)) {
      parsed.searchParams.delete(key)
    }
  }
  return parsed.toString()
}

export function parseUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s,\n"'<>]+/gi) ?? []
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of matches) {
    const cleaned = cleanJobUrl(raw.replace(/[.,;:)]+$/, ''))
    if (!seen.has(cleaned)) {
      seen.add(cleaned)
      result.push(cleaned)
    }
  }

  return result.slice(0, 50)
}
