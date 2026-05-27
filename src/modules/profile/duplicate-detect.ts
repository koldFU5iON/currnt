import type { ExtractedActivity, ExtractedSkill } from './extract-schema'

// Minimum Jaccard token-overlap to flag as a near-match.
// Loose enough to catch paraphrases ("Led K8s migration" vs "Led Kubernetes
// migration"), tight enough to avoid flagging unrelated short sentences.
const JACCARD_THRESHOLD = 0.5

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function tokenSet(s: string): Set<string> {
  return new Set(normalize(s).split(' ').filter(Boolean))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const t of a) if (b.has(t)) intersection++
  return intersection / (a.size + b.size - intersection)
}

function findMatch(candidate: string, existingTexts: { id: string; text: string }[]): string | null {
  const normCandidate = normalize(candidate)
  const tokensCandidate = tokenSet(candidate)

  for (const { id, text } of existingTexts) {
    if (normalize(text) === normCandidate) return id
    if (jaccard(tokensCandidate, tokenSet(text)) >= JACCARD_THRESHOLD) return id
  }
  return null
}

// ------------------------------------------------------------------
// Public types
// ------------------------------------------------------------------

export type ActivityWithMatch = ExtractedActivity & { nearMatchId: string | null }
export type SkillWithMatch = ExtractedSkill & { nearMatchId: string | null }

export type SuggestionsWithMatches = {
  activities: ActivityWithMatch[]
  skills: SkillWithMatch[]
}

// ------------------------------------------------------------------
// Existing-entity shapes the caller passes in
// ------------------------------------------------------------------

export type ExistingActivity = { id: string; description: string }
export type ExistingSkill = { id: string; name: string }

// ------------------------------------------------------------------
// annotateMatches
// ------------------------------------------------------------------

export function annotateMatches(
  suggestions: { activities: ExtractedActivity[]; skills: ExtractedSkill[] },
  existing: { activities: ExistingActivity[]; skills: ExistingSkill[] },
): SuggestionsWithMatches {
  const existingActivityTexts = existing.activities.map((a) => ({ id: a.id, text: a.description }))
  const existingSkillTexts = existing.skills.map((s) => ({ id: s.id, text: s.name }))

  return {
    activities: suggestions.activities.map((a) => ({
      ...a,
      nearMatchId: findMatch(a.description, existingActivityTexts),
    })),
    skills: suggestions.skills.map((s) => ({
      ...s,
      nearMatchId: findMatch(s.name, existingSkillTexts),
    })),
  }
}
