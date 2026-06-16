import { z } from 'zod'

// ── Dimension types ──────────────────────────────────────────────────────────

export type DimensionResult = {
  score: number               // 0–100
  weight: number              // e.g. 0.45
  weightedContribution: number
}

export type KeywordMatch = {
  keyword: string
  section: string
  sectionWeight: number
}

export type ImpliedKeywordMatch = {
  keyword: string
  section: string
}

export type KeywordCoverageDetail = DimensionResult & {
  matchedRequired: KeywordMatch[]
  matchedPreferred: KeywordMatch[]
  matchedImplied: ImpliedKeywordMatch[]
  missingRequired: string[]
  missingPreferred: string[]
  missingImplied: string[]
}

export type TitleAlignmentDetail = DimensionResult & {
  jdTitle: string | null
  cvTitle: string | null
  matchedTokens: string[]
}

export type SectionCompletenessDetail = DimensionResult & {
  expectedSections: string[]
  presentSections: string[]
  missingSections: string[]
}

export type SenioritySignalDetail = DimensionResult & {
  jdRequiredYears: number | null
  cvTotalYears: number
  seniorityBasis: 'years' | 'keywords' | 'neutral'
}

// ── Aggregate types ──────────────────────────────────────────────────────────

export type ATSScoreBreakdown = {
  finalScore: number
  label: 'poor' | 'fair' | 'good' | 'strong' | 'excellent'
  dimensions: {
    keywordCoverage: KeywordCoverageDetail
    titleAlignment: TitleAlignmentDetail
    sectionCompleteness: SectionCompletenessDetail
    senioritySignal: SenioritySignalDetail
  }
}

export type ProfileOpportunity = {
  asset: string           // e.g. "Docker (skill, expert)"
  targetSection: string   // e.g. "tools"
  rationale: string
}

export type ATSInterpretation = {
  summary: string
  dimensionNotes: Array<{
    dimension: keyof ATSScoreBreakdown['dimensions']
    note: string
  }>
  profileOpportunities: ProfileOpportunity[]
}

export type ATSScoreResult = {
  breakdown: ATSScoreBreakdown
  interpretation: ATSInterpretation | null
  impliedKeywords: string[]
}

// ── Zod schemas for LLM outputs ──────────────────────────────────────────────

export const ImpliedKeywordsSchema = z.object({
  keywords: z.array(z.string()).describe(
    'Implied/adjacent keywords an ATS would score against for this role — not already listed in the JD',
  ),
})

export const ATSInterpretationSchema = z.object({
  summary: z.string().describe('2–3 sentences explaining why the CV scored what it did. Be specific.'),
  dimensionNotes: z.array(
    z.object({
      dimension: z.enum(['keywordCoverage', 'titleAlignment', 'sectionCompleteness', 'senioritySignal']),
      note: z.string().describe('One sentence explaining that dimension\'s sub-score'),
    }),
  ),
  profileOpportunities: z.array(
    z.object({
      asset: z.string().describe('e.g. "Docker (skill, expert level)"'),
      targetSection: z.string().describe('CV section type to add it to, e.g. "tools"'),
      rationale: z.string().describe('Why this would improve the ATS score'),
    }),
  ).describe(
    'ONLY include items verifiably present in the candidate profile provided. Do not suggest skills the candidate does not have.',
  ),
})

// ── Chat context serializer ──────────────────────────────────────────────────
// Called client-side from ats-score-panel.tsx — must not be async.

export function serializeATSScoreForContext(result: ATSScoreResult): string {
  const { breakdown, interpretation } = result
  const { dimensions: d } = breakdown
  const lines: string[] = []

  lines.push(`ATS Score: ${breakdown.finalScore}/100 (${breakdown.label})`)
  lines.push('')

  const kwScore = Math.round(d.keywordCoverage.score)
  const matchedCount = d.keywordCoverage.matchedRequired.length + d.keywordCoverage.matchedPreferred.length
  lines.push(`Keyword coverage (${kwScore}/100): ${matchedCount} explicit keyword(s) matched.`)
  if (d.keywordCoverage.missingRequired.length > 0) {
    lines.push(`  Missing required: ${d.keywordCoverage.missingRequired.join(', ')}`)
  }
  if (d.keywordCoverage.missingPreferred.length > 0) {
    lines.push(`  Missing preferred: ${d.keywordCoverage.missingPreferred.join(', ')}`)
  }
  lines.push('')

  lines.push(
    `Title alignment (${Math.round(d.titleAlignment.score)}/100): ` +
    `CV shows "${d.titleAlignment.cvTitle ?? 'unknown'}"; JD targets "${d.titleAlignment.jdTitle ?? 'unknown'}"`,
  )
  lines.push('')

  const sectionNote = d.sectionCompleteness.missingSections.length > 0
    ? `missing ${d.sectionCompleteness.missingSections.join(', ')} section(s)`
    : 'all expected sections present'
  lines.push(`Section completeness (${Math.round(d.sectionCompleteness.score)}/100): ${sectionNote}`)
  lines.push('')

  if (d.senioritySignal.jdRequiredYears !== null) {
    lines.push(
      `Seniority signal (${Math.round(d.senioritySignal.score)}/100): ` +
      `JD requires ${d.senioritySignal.jdRequiredYears}+ years; ` +
      `CV totals ~${d.senioritySignal.cvTotalYears.toFixed(1)} years`,
    )
  } else {
    lines.push(
      `Seniority signal (${Math.round(d.senioritySignal.score)}/100): no explicit year requirement in JD`,
    )
  }

  if (interpretation?.profileOpportunities.length) {
    lines.push('')
    lines.push('Profile opportunities (exist in profile, not surfaced in this CV):')
    for (const opp of interpretation.profileOpportunities) {
      lines.push(`  - ${opp.asset} → ${opp.targetSection}: ${opp.rationale}`)
    }
  }

  return lines.join('\n')
}
