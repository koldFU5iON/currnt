import type { ExtractedActivity, ExtractedSkill } from './extract-schema'

// Recognized H2 heading tags. Case-insensitive match.
const RECOGNIZED_HEADINGS = ['overview', 'responsibilities', 'achievements', 'skills'] as const
type RecognizedHeading = (typeof RECOGNIZED_HEADINGS)[number]

export type ParseResult = {
  overview: string | null
  activities: ExtractedActivity[]
  skills: ExtractedSkill[]
  unparsed: string // prose under no recognized heading; fed to LLM tier
}

// Matches "## SomeHeading" (leading/trailing whitespace tolerated).
const H2_RE = /^#{1,2}\s+(.+)$/

function normalizeHeading(raw: string): RecognizedHeading | null {
  const lower = raw.trim().toLowerCase()
  return (RECOGNIZED_HEADINGS as readonly string[]).includes(lower)
    ? (lower as RecognizedHeading)
    : null
}

// A bullet line: starts with "- " or "* " after optional leading whitespace.
const BULLET_RE = /^\s*[-*]\s+(.+)$/

// An impact line: starts with ">" after optional leading whitespace.
const IMPACT_RE = /^\s*>\s*(.*)$/

export function parseNotes(markdown: string): ParseResult {
  if (!markdown.trim()) {
    return { overview: null, activities: [], skills: [], unparsed: '' }
  }

  const lines = markdown.split('\n')

  let currentHeading: RecognizedHeading | null = null
  const buckets: Record<RecognizedHeading, string[]> = {
    overview: [],
    responsibilities: [],
    achievements: [],
    skills: [],
  }
  const unparsedLines: string[] = []

  // We track the last bullet added to the current bucket so that a following
  // `>` impact line can be stitched to it.
  let lastBucketTarget: string[] | null = null
  let lastBulletIndex = -1 // index into lastBucketTarget

  for (const line of lines) {
    const h2Match = line.match(H2_RE)
    if (h2Match) {
      const heading = normalizeHeading(h2Match[1])
      currentHeading = heading
      lastBucketTarget = null
      lastBulletIndex = -1
      // If it's an unrecognized H2, subsequent lines still need a home.
      // They'll fall through to the unparsed branch below.
      continue
    }

    if (currentHeading === null) {
      // Pre-heading prose or under an unrecognized heading → unparsed.
      unparsedLines.push(line)
      lastBucketTarget = null
      lastBulletIndex = -1
      continue
    }

    const bucket = buckets[currentHeading]

    const bulletMatch = line.match(BULLET_RE)
    if (bulletMatch) {
      bucket.push(bulletMatch[1].trim())
      lastBucketTarget = bucket
      lastBulletIndex = bucket.length - 1
      continue
    }

    const impactMatch = line.match(IMPACT_RE)
    if (impactMatch && lastBucketTarget !== null && lastBulletIndex >= 0) {
      // Attach impact to the preceding bullet using a sentinel delimiter.
      // Parsed downstream when converting bucket lines → items.
      const impactText = impactMatch[1].trim()
      if (impactText) {
        lastBucketTarget[lastBulletIndex] =
          lastBucketTarget[lastBulletIndex] + '\x00' + impactText
      }
      continue
    }

    // Non-bullet, non-impact lines inside a recognized heading:
    // plain prose paragraphs — keep them in the bucket as-is (overview uses
    // them; for activity/skill headings they're noise but still user content).
    if (line.trim()) {
      bucket.push(line.trim())
      lastBucketTarget = bucket
      lastBulletIndex = bucket.length - 1
    } else {
      // Blank lines reset the impact-attachment cursor.
      lastBucketTarget = null
      lastBulletIndex = -1
    }
  }

  // Build structured outputs from buckets.
  const activities: ExtractedActivity[] = []

  for (const raw of buckets.responsibilities) {
    const [description, impact = null] = raw.split('\x00')
    activities.push({ kind: 'responsibility', description, impact, source: 'parser' })
  }

  for (const raw of buckets.achievements) {
    const [description, impact = null] = raw.split('\x00')
    activities.push({ kind: 'achievement', description, impact, source: 'parser' })
  }

  const skills: ExtractedSkill[] = buckets.skills.map((raw) => {
    const [name] = raw.split('\x00')
    return { name, category: null, level: null, source: 'parser' }
  })

  const overview =
    buckets.overview.length > 0 ? buckets.overview.join('\n').trim() : null

  const unparsed = unparsedLines
    .join('\n')
    .trim()

  return { overview, activities, skills, unparsed }
}
