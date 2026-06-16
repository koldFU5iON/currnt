// No imports needed for Task 2 — all pure string/regex logic

// ── Stop words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'shall', 'can', 'need', 'dare', 'ought', 'used', 'able',
  'you', 'your', 'we', 'our', 'they', 'their', 'it', 'its',
  'this', 'that', 'these', 'those', 'who', 'what', 'which', 'when',
  'where', 'why', 'how', 'not', 'no', 'nor', 'so', 'yet', 'both',
  'either', 'neither', 'as', 'if', 'then', 'than', 'because', 'while',
  'although', 'though', 'since', 'unless', 'until', 'after', 'before',
  'role', 'job', 'position', 'candidate', 'applicant', 'apply',
  'team', 'company', 'organization', 'strong', 'good', 'excellent', 'great',
  'skills', 'knowledge', 'understanding', 'experience', 'years',
  'minimum', 'required', 'preferred', 'ideally', 'plus', 'bonus', 'etc',
])

// ── Seniority levels ──────────────────────────────────────────────────────────

const SENIORITY_LEVELS: Record<string, number> = {
  junior: 1, entry: 1, graduate: 1, associate: 2, mid: 3,
  senior: 4, sr: 4, lead: 5, staff: 5, principal: 6, head: 7,
  director: 7, vp: 8, chief: 9,
}

// ── Text utilities ───────────────────────────────────────────────────────────

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(text: string): string[] {
  if (!text.trim()) return []
  return normalizeText(text)
    .split(' ')
    .filter(token => token.length > 1 && !STOP_WORDS.has(token))
}

// ── JD parsing ───────────────────────────────────────────────────────────────

// Regex patterns for JD section markers
const REQUIRED_SECTION_RE = /(?:requirements?|qualifications?|must\s+have|essential|you\s+(?:will\s+)?need|what\s+we(?:'re|\s+are)\s+looking\s+for)\s*:?\s*\n/i
const PREFERRED_SECTION_RE = /(?:nice\s+to\s+have|preferred|bonus|desirable|plus(?:es)?|would\s+be\s+great|ideal(?:ly)?)\s*:?\s*\n/i
const NEXT_SECTION_RE = /^(?:#+\s|\*\*|__|\w[^\n]*:\s*$)/m

function extractSection(jdText: string, startPattern: RegExp): string | null {
  const match = startPattern.exec(jdText)
  if (!match) return null
  const start = match.index + match[0].length
  const remaining = jdText.slice(start)
  const nextMatch = NEXT_SECTION_RE.exec(remaining)
  return nextMatch ? remaining.slice(0, nextMatch.index) : remaining
}

export function extractJDKeywords(jdText: string): { required: string[]; preferred: string[] } {
  const requiredSection = extractSection(jdText, REQUIRED_SECTION_RE)
  const preferredSection = extractSection(jdText, PREFERRED_SECTION_RE)

  const requiredTokens = requiredSection ? tokenize(requiredSection) : []
  const requiredSet = new Set(requiredTokens)

  const preferredTokens = preferredSection
    ? tokenize(preferredSection).filter(t => !requiredSet.has(t))
    : []

  // If no explicit sections found, tokenize the whole JD as required
  if (!requiredSection && !preferredSection) {
    return { required: tokenize(jdText), preferred: [] }
  }

  return { required: requiredTokens, preferred: preferredTokens }
}

export function extractJDTitle(jdText: string): string | null {
  // Try markdown H1 heading at start
  const h1Match = /^#\s+(.+)$/m.exec(jdText)
  if (h1Match) return h1Match[1].trim()

  // Try "Role:" or "Position:" prefix
  const roleMatch = /^(?:role|position|title|job\s+title)\s*:\s*(.+)$/im.exec(jdText)
  if (roleMatch) return roleMatch[1].trim()

  return null
}

export function extractJDYearsRequired(jdText: string): number | null {
  const pattern = /(\d+)\+?\s*(?:to\s*\d+)?\s*years?/gi
  const matches = [...jdText.matchAll(pattern)]
  if (matches.length === 0) return null
  return Math.max(...matches.map(m => parseInt(m[1], 10)))
}

export function extractJDSeniorityLevel(jdText: string): number | null {
  const lower = jdText.toLowerCase()
  // Check in descending order to return the highest matched level
  const levels = Object.entries(SENIORITY_LEVELS).sort((a, b) => b[1] - a[1])
  for (const [keyword, level] of levels) {
    if (new RegExp(`\\b${keyword}\\b`).test(lower)) {
      return level
    }
  }
  return null
}

export function inferExpectedSections(jdText: string): string[] {
  const sections: string[] = ['skills', 'experience'] // always expected
  const lower = jdText.toLowerCase()

  if (/\b(?:tool|platform|software|system|docker|kubernetes|aws|gcp|azure)\b/.test(lower)) {
    sections.push('tools')
  }
  if (/\b(?:degree|bachelor|master|phd|bsc|msc|computer science|engineering)\b/.test(lower)) {
    sections.push('education')
  }
  if (/\b(?:certif|pmp|cpa|cfa|cia|cissp)/.test(lower)) {
    sections.push('certifications')
  }

  return [...new Set(sections)]
}
