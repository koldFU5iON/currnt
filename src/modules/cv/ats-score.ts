import type { CVDocumentContent } from './schema'
import type {
  KeywordCoverageDetail,
  KeywordMatch,
  ImpliedKeywordMatch,
} from './ats-score-schema'

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

// ── CV text extraction ───────────────────────────────────────────────────────

export type SectionToken = {
  text: string
  sectionType: string
  weight: number
}

export function extractCVSectionTokens(cvContent: CVDocumentContent): SectionToken[] {
  const tokens: SectionToken[] = []

  for (const section of cvContent.sections.filter(s => s.visible)) {
    switch (section.type) {
      case 'skills':
        for (const item of section.data.items) {
          tokens.push({ text: item.toLowerCase(), sectionType: 'skills', weight: 1.0 })
        }
        break
      case 'tools':
        for (const item of section.data.items) {
          tokens.push({ text: item.toLowerCase(), sectionType: 'tools', weight: 1.0 })
        }
        break
      case 'competencies':
        for (const item of section.data.items) {
          tokens.push({ text: item.toLowerCase(), sectionType: 'competencies', weight: 0.9 })
        }
        break
      case 'capabilities':
        for (const item of section.data.items) {
          tokens.push({ text: item.toLowerCase(), sectionType: 'capabilities', weight: 0.9 })
        }
        break
      case 'experience': {
        const d = section.data
        const titleText = d.titles.join(' ').toLowerCase()
        tokens.push({ text: titleText, sectionType: 'exp-title', weight: 0.9 })
        const bodyText = [d.description, ...d.outcomes].join(' ').toLowerCase()
        tokens.push({ text: bodyText, sectionType: 'exp-body', weight: 0.7 })
        break
      }
      case 'profile':
        tokens.push({ text: section.data.content.toLowerCase(), sectionType: 'profile', weight: 0.6 })
        break
      case 'education': {
        const d = section.data
        const text = [d.qualification, d.field, d.institution].filter(Boolean).join(' ').toLowerCase()
        tokens.push({ text, sectionType: 'education', weight: 0.5 })
        break
      }
      case 'certification':
        tokens.push({ text: section.data.name.toLowerCase(), sectionType: 'certification', weight: 0.5 })
        break
      // header, languages: intentionally skipped — not scored by ATS engine
    }
  }

  return tokens
}

export function parseDurationToYears(duration: string): number {
  const MONTH_MAP: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  }

  const parts = duration.split(/\s*[–—-]\s*/)
  if (parts.length < 2) return 0
  const [startStr, endStr] = parts

  function parseDate(s: string): Date | null {
    const lower = s.toLowerCase().trim()
    if (['present', 'current', 'now', 'today'].includes(lower)) return new Date()

    const monthYear = lower.match(/([a-z]{3})\s+(\d{4})/)
    if (monthYear) {
      const month = MONTH_MAP[monthYear[1]]
      const year = parseInt(monthYear[2], 10)
      if (month !== undefined && !isNaN(year)) return new Date(year, month, 1)
    }

    const yearOnly = lower.match(/^(\d{4})$/)
    if (yearOnly) return new Date(parseInt(yearOnly[1], 10), 6, 1)

    return null
  }

  const start = parseDate(startStr)
  const end = parseDate(endStr)
  if (!start || !end) return 0

  return Math.max(0, (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

// ── Keyword matching helper ───────────────────────────────────────────────────

function keywordMatchesToken(keyword: string, token: SectionToken): boolean {
  const kw = normalizeText(keyword)
  if (kw.length < 3) return false
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`).test(token.text)
}

function findBestMatch(
  keyword: string,
  sectionTokens: SectionToken[],
): { section: string; sectionWeight: number } | null {
  let best: { section: string; sectionWeight: number } | null = null
  for (const token of sectionTokens) {
    if (keywordMatchesToken(keyword, token)) {
      if (!best || token.weight > best.sectionWeight) {
        best = { section: token.sectionType, sectionWeight: token.weight }
      }
    }
  }
  return best
}

// ── Dimension 1: Keyword Coverage (weight: 0.45) ─────────────────────────────

export function scoreKeywordCoverage(
  cvContent: CVDocumentContent,
  requiredKeywords: string[],
  preferredKeywords: string[],
  impliedKeywords: string[],
): KeywordCoverageDetail {
  const WEIGHT = 0.45
  const sectionTokens = extractCVSectionTokens(cvContent)

  const matchedRequired: KeywordMatch[] = []
  const missingRequired: string[] = []
  const matchedPreferred: KeywordMatch[] = []
  const missingPreferred: string[] = []
  const matchedImplied: ImpliedKeywordMatch[] = []
  const missingImplied: string[] = []

  for (const kw of requiredKeywords) {
    const match = findBestMatch(kw, sectionTokens)
    if (match) matchedRequired.push({ keyword: kw, ...match })
    else missingRequired.push(kw)
  }

  for (const kw of preferredKeywords) {
    const match = findBestMatch(kw, sectionTokens)
    if (match) matchedPreferred.push({ keyword: kw, ...match })
    else missingPreferred.push(kw)
  }

  for (const kw of impliedKeywords) {
    const match = findBestMatch(kw, sectionTokens)
    if (match) matchedImplied.push({ keyword: kw, section: match.section })
    else missingImplied.push(kw)
  }

  const totalRequired = requiredKeywords.length
  const totalPreferred = preferredKeywords.length
  const totalImplied = impliedKeywords.length

  // Required contributes 70% of score, section-weighted (skills match > body match)
  const requiredScore = totalRequired === 0
    ? 1
    : matchedRequired.reduce((s, m) => s + m.sectionWeight, 0) / totalRequired

  // Preferred explicit: section-weighted match rate
  const preferredExplicitScore = totalPreferred === 0
    ? 1
    : matchedPreferred.reduce((s, m) => s + m.sectionWeight, 0) / totalPreferred

  // Implied: flat match rate (no section weight — they're bonus signals), capped at 0.5
  const impliedScore = totalImplied === 0
    ? 1
    : (matchedImplied.length / totalImplied) * 0.5

  // Preferred score blends explicit preferred (75%) and implied (25%)
  const preferredScore = totalPreferred === 0 && totalImplied === 0
    ? 1
    : preferredExplicitScore * 0.75 + impliedScore * 0.25

  // Only include preferredScore in the blend when there ARE preferred/implied keywords
  const hasPreferredOrImplied = totalPreferred > 0 || totalImplied > 0

  const raw = hasPreferredOrImplied
    ? (requiredScore * 0.70 + preferredScore * 0.30) * 100
    : requiredScore * 100

  const score = Math.min(100, Math.max(0, Math.round(raw)))

  return {
    score,
    weight: WEIGHT,
    weightedContribution: score * WEIGHT,
    matchedRequired,
    matchedPreferred,
    matchedImplied,
    missingRequired,
    missingPreferred,
    missingImplied,
  }
}
