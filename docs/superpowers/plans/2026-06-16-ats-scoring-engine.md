# ATS Scoring Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an on-demand ATS scoring engine that evaluates a generated CV against a job description using four deterministic weighted dimensions, with an LLM-powered interpretation layer that surfaces profile-grounded improvement opportunities.

**Architecture:** A pure function `scoreATS(cvContent, jobDescription, impliedKeywords)` computes four dimension scores deterministically. A server action orchestrates the full pipeline: (1) LLM call to expand implied JD keywords, (2) deterministic scoring, (3) LLM call for human-readable interpretation. Results live in React state; the chat coach integration passes the score into the existing `cv` PageContext via `setContext` + `openPanel`.

**Tech Stack:** TypeScript strict, Vitest, Zod, Next.js 16 server actions, Tailwind CSS, shadcn/ui, `@/modules/llm/client` for LLM calls.

**Spec:** `docs/superpowers/specs/2026-06-16-ats-scoring-engine-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/modules/cv/ats-score-schema.ts` | **Create** | TS types, Zod schemas for LLM outputs, `serializeATSScoreForContext` |
| `src/modules/cv/ats-score-schema.test.ts` | **Create** | Tests for the serializer |
| `src/modules/cv/ats-score.ts` | **Create** | Pure deterministic scoring engine — all four dimensions + aggregation |
| `src/modules/cv/ats-score.test.ts` | **Create** | Unit + integration tests for every engine function |
| `src/modules/cv/ats-score-action.ts` | **Create** | `'use server'` action: reads DB → expand keywords → score → interpret |
| `src/modules/chat/schema.ts` | **Modify** | Add `atsScore?: string` to the `cv` PageContext variant |
| `src/modules/chat/context.ts` | **Modify** | Extend `formatPageContext` cv case to include ATS breakdown |
| `src/app/dashboard/cv-builder/[id]/_components/ats-score-panel.tsx` | **Create** | UI: "Run ATS Check" trigger, score display, "Discuss with coach" |
| `src/app/dashboard/cv-builder/[id]/_components/cv-editor.tsx` | **Modify** | Add ATS panel state, render `<ATSScorePanel>`, "ATS" toolbar button |
| `src/app/dashboard/settings/usage/_components/usage-log.tsx` | **Modify** | Register `ats-keyword-expand` and `ats-interpret` feature labels |

---

## Task 1: Types, Zod schemas, and context serializer

**Files:**
- Create: `src/modules/cv/ats-score-schema.ts`
- Create: `src/modules/cv/ats-score-schema.test.ts`

- [ ] **Step 1.1: Write the failing test for `serializeATSScoreForContext`**

Create `src/modules/cv/ats-score-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { serializeATSScoreForContext } from './ats-score-schema'
import type { ATSScoreResult } from './ats-score-schema'

const MOCK_RESULT: ATSScoreResult = {
  breakdown: {
    finalScore: 68,
    label: 'good',
    dimensions: {
      keywordCoverage: {
        score: 72, weight: 0.45, weightedContribution: 32.4,
        matchedRequired: [{ keyword: 'typescript', section: 'skills', sectionWeight: 1.0 }],
        matchedPreferred: [],
        matchedImplied: [{ keyword: 'javascript', section: 'skills' }],
        missingRequired: ['docker', 'kubernetes'],
        missingPreferred: ['helm'],
        missingImplied: [],
      },
      titleAlignment: {
        score: 65, weight: 0.20, weightedContribution: 13,
        jdTitle: 'Senior Platform Engineer',
        cvTitle: 'Senior Software Engineer',
        matchedTokens: ['senior', 'engineer'],
      },
      sectionCompleteness: {
        score: 85, weight: 0.20, weightedContribution: 17,
        expectedSections: ['skills', 'tools'],
        presentSections: ['skills'],
        missingSections: ['tools'],
      },
      senioritySignal: {
        score: 80, weight: 0.15, weightedContribution: 12,
        jdRequiredYears: 5,
        cvTotalYears: 6.2,
        seniorityBasis: 'years',
      },
    },
  },
  interpretation: {
    summary: 'Your CV scores 68/100.',
    dimensionNotes: [],
    profileOpportunities: [
      { asset: 'Docker (skill, expert)', targetSection: 'tools', rationale: 'JD requires Docker' },
    ],
  },
  impliedKeywords: ['javascript'],
}

describe('serializeATSScoreForContext', () => {
  it('includes final score and label', () => {
    const output = serializeATSScoreForContext(MOCK_RESULT)
    expect(output).toContain('68/100')
    expect(output).toContain('good')
  })

  it('lists missing required keywords', () => {
    const output = serializeATSScoreForContext(MOCK_RESULT)
    expect(output).toContain('docker')
    expect(output).toContain('kubernetes')
  })

  it('shows title comparison', () => {
    const output = serializeATSScoreForContext(MOCK_RESULT)
    expect(output).toContain('Senior Platform Engineer')
    expect(output).toContain('Senior Software Engineer')
  })

  it('lists profile opportunities', () => {
    const output = serializeATSScoreForContext(MOCK_RESULT)
    expect(output).toContain('Docker (skill, expert)')
  })

  it('handles null interpretation gracefully', () => {
    const result = { ...MOCK_RESULT, interpretation: null }
    expect(() => serializeATSScoreForContext(result)).not.toThrow()
  })
})
```

- [ ] **Step 1.2: Run the test to confirm it fails**

```bash
npm test -- src/modules/cv/ats-score-schema.test.ts
```

Expected: `FAIL` — `ats-score-schema.ts` does not exist yet.

- [ ] **Step 1.3: Create `src/modules/cv/ats-score-schema.ts`**

```typescript
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
```

- [ ] **Step 1.4: Run tests — confirm passing**

```bash
npm test -- src/modules/cv/ats-score-schema.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/modules/cv/ats-score-schema.ts src/modules/cv/ats-score-schema.test.ts
git commit -m "feat(ats): add output types, Zod schemas, and context serializer"
```

---

## Task 2: JD parsing utilities

**Files:**
- Create: `src/modules/cv/ats-score.ts` (initial section — parsing utilities only)
- Create: `src/modules/cv/ats-score.test.ts` (parsing tests)

- [ ] **Step 2.1: Write failing tests for JD parsing**

Create `src/modules/cv/ats-score.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  tokenize,
  extractJDKeywords,
  extractJDTitle,
  extractJDYearsRequired,
} from './ats-score'

describe('normalizeText', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeText('React.js, TypeScript!')).toBe('react js typescript')
  })

  it('preserves hyphens between words', () => {
    expect(normalizeText('full-stack')).toBe('full-stack')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeText('a  b   c')).toBe('a b c')
  })
})

describe('tokenize', () => {
  it('removes stop words', () => {
    const tokens = tokenize('experience with the React and TypeScript')
    expect(tokens).not.toContain('the')
    expect(tokens).not.toContain('and')
    expect(tokens).not.toContain('with')
    expect(tokens).toContain('react')
    expect(tokens).toContain('typescript')
  })

  it('filters tokens shorter than 3 characters', () => {
    const tokens = tokenize('AWS S3 storage')
    expect(tokens).not.toContain('s3')
    expect(tokens).toContain('aws')
    expect(tokens).toContain('storage')
  })
})

describe('extractJDKeywords', () => {
  it('classifies required keywords by signal words', () => {
    const jd = 'You must have experience with React. TypeScript is required.'
    const { required } = extractJDKeywords(jd)
    expect(required.some(k => k.includes('react'))).toBe(true)
    expect(required.some(k => k.includes('typescript'))).toBe(true)
  })

  it('classifies preferred keywords by signal words', () => {
    const jd = 'Experience with Docker is preferred. Kubernetes is a bonus.'
    const { preferred } = extractJDKeywords(jd)
    expect(preferred.some(k => k.includes('docker'))).toBe(true)
    expect(preferred.some(k => k.includes('kubernetes'))).toBe(true)
  })

  it('defaults unclassified keywords to preferred', () => {
    const jd = 'We use PostgreSQL and Redis in our stack.'
    const { preferred } = extractJDKeywords(jd)
    expect(preferred.some(k => k.includes('postgresql'))).toBe(true)
  })

  it('does not duplicate keywords across required and preferred', () => {
    const jd = 'Python is required. We also use Python for data pipelines.'
    const { required, preferred } = extractJDKeywords(jd)
    const requiredHasPython = required.some(k => k.includes('python'))
    const preferredHasPython = preferred.some(k => k.includes('python'))
    // Should not appear in both
    expect(requiredHasPython && preferredHasPython).toBe(false)
  })
})

describe('extractJDTitle', () => {
  it('extracts title from "Job Title:" prefix', () => {
    const jd = 'Job Title: Senior Frontend Engineer\n\nAbout the role...'
    expect(extractJDTitle(jd)).toBe('Senior Frontend Engineer')
  })

  it('extracts title from "Role:" prefix', () => {
    const jd = 'Role: Lead Product Designer\n\nResponsibilities...'
    expect(extractJDTitle(jd)).toBe('Lead Product Designer')
  })

  it('returns null when no title found', () => {
    const jd = 'We are looking for someone experienced in cloud infrastructure.'
    expect(extractJDTitle(jd)).toBeNull()
  })
})

describe('extractJDYearsRequired', () => {
  it('extracts explicit year requirements', () => {
    expect(extractJDYearsRequired('You need 5+ years of experience')).toBe(5)
    expect(extractJDYearsRequired('Minimum 3 years in a similar role')).toBe(3)
    expect(extractJDYearsRequired('At least 7 years of relevant experience')).toBe(7)
  })

  it('takes the minimum of a range', () => {
    expect(extractJDYearsRequired('3-5 years of experience required')).toBe(3)
  })

  it('returns null when no year requirement found', () => {
    expect(extractJDYearsRequired('Strong communication skills required')).toBeNull()
  })
})
```

- [ ] **Step 2.2: Run tests — confirm they fail**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 2.3: Create `src/modules/cv/ats-score.ts` with parsing utilities**

```typescript
import type { CVDocumentContent } from './schema'
import type {
  ATSScoreBreakdown,
  KeywordCoverageDetail,
  TitleAlignmentDetail,
  SectionCompletenessDetail,
  SenioritySignalDetail,
  KeywordMatch,
  ImpliedKeywordMatch,
} from './ats-score-schema'

// ── Constants ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'into', 'as', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'that',
  'this', 'these', 'those', 'it', 'its', 'we', 'you', 'they', 'our',
  'who', 'which', 'what', 'how', 'when', 'where', 'why', 'not', 'no',
  'can', 'about', 'up', 'out', 'if', 'then', 'than', 'so', 'also',
  'your', 'their', 'his', 'her', 'its', 'any', 'all', 'both', 'each',
])

const SECTION_WEIGHTS: Partial<Record<string, number>> = {
  skills:         1.0,
  tools:          1.0,
  competencies:   0.9,
  capabilities:   0.9,
  'exp-title':    0.9,
  'exp-body':     0.7,
  profile:        0.6,
  education:      0.5,
  certification:  0.5,
}

const REQUIRED_SIGNALS = /\b(must|required|essential|minimum|necessary)\b/i
const PREFERRED_SIGNALS = /\b(preferred|desirable|ideally|bonus|nice[\s-]to[\s-]have|advantageous)\b/i

const SENIORITY_LEVELS: Record<string, number> = {
  junior: 1, entry: 1, graduate: 1,
  associate: 2, mid: 3,
  senior: 4, sr: 4,
  lead: 5, staff: 5,
  principal: 6, head: 7, director: 7,
  vp: 8, chief: 9,
}

// ── Text normalisation ───────────────────────────────────────────────────────

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/-+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t))
}

function bigrams(tokens: string[]): string[] {
  const result: string[] = []
  for (let i = 0; i < tokens.length - 1; i++) {
    result.push(`${tokens[i]} ${tokens[i + 1]}`)
  }
  return result
}

// ── JD parsing ───────────────────────────────────────────────────────────────

export function extractJDKeywords(
  jdText: string,
): { required: string[]; preferred: string[] } {
  const sentences = jdText.split(/[.!\n]+/).filter(s => s.trim().length > 5)

  const required = new Map<string, true>()
  const preferred = new Map<string, true>()

  for (const sentence of sentences) {
    const isRequired = REQUIRED_SIGNALS.test(sentence)
    const isPreferred = PREFERRED_SIGNALS.test(sentence)

    const tokens = tokenize(sentence)
    const candidates = [...bigrams(tokens), ...tokens]

    for (const term of candidates) {
      // Once a term is in required, don't downgrade to preferred
      if (required.has(term)) continue
      if (isRequired) {
        required.set(term, true)
        preferred.delete(term)
      } else {
        preferred.set(term, true)
      }
    }
  }

  return {
    required: Array.from(required.keys()),
    preferred: Array.from(preferred.keys()),
  }
}

export function extractJDTitle(jdText: string): string | null {
  const patterns = [
    /^(?:job\s*title|role|position|title)\s*:\s*(.+)/im,
    /^\*{1,2}(.+?)\*{1,2}\s*$/m,
  ]
  for (const pattern of patterns) {
    const match = jdText.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

export function extractJDYearsRequired(jdText: string): number | null {
  const patterns = [
    /(\d+)\s*[-–]\s*\d+\s*years?/i,     // range: take lower bound
    /(\d+)\+?\s*years?\s+(?:of\s+)?(?:experience|exp)/i,
    /(?:minimum|at\s+least|min\.?)\s*(\d+)\s*years?/i,
  ]
  for (const pattern of patterns) {
    const match = jdText.match(pattern)
    if (match) return parseInt(match[1], 10)
  }
  return null
}

export function extractJDSeniorityLevel(jdText: string): number | null {
  const lower = jdText.toLowerCase()
  let highest: number | null = null
  for (const [word, level] of Object.entries(SENIORITY_LEVELS)) {
    const regex = new RegExp(`\\b${word}\\b`)
    if (regex.test(lower)) {
      if (highest === null || level > highest) highest = level
    }
  }
  return highest
}

export function inferExpectedSections(jdText: string): string[] {
  const lower = jdText.toLowerCase()
  const expected: string[] = []

  const techSignals = /\b(engineer|developer|architect|programming|framework|backend|frontend|fullstack|devops|cloud)\b/i
  const leadershipSignals = /\b(manag|leads?\s+a\s+team|direct\s+reports?|people\s+manager|reports\s+to\b)\b/i
  const academicSignals = /\b(phd|doctorate|research|publications?|academic)\b/i

  if (techSignals.test(lower)) {
    expected.push('skills', 'tools')
  }
  if (leadershipSignals.test(lower)) {
    expected.push('competencies')
  }
  if (academicSignals.test(lower)) {
    expected.push('education')
  }

  return [...new Set(expected)]
}
```

- [ ] **Step 2.4: Run tests — confirm passing**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

Expected: all parsing tests pass (dimension tests are not yet written, this only runs what exists).

- [ ] **Step 2.5: Commit**

```bash
git add src/modules/cv/ats-score.ts src/modules/cv/ats-score.test.ts
git commit -m "feat(ats): add JD parsing utilities with tests"
```

---

## Task 3: CV text extraction

**Files:**
- Modify: `src/modules/cv/ats-score.ts` (add CV extraction)
- Modify: `src/modules/cv/ats-score.test.ts` (add extraction tests)

- [ ] **Step 3.1: Add failing tests for CV extraction**

Append to `src/modules/cv/ats-score.test.ts`:

```typescript
import type { CVDocumentContent } from './schema'
// Add this import at the top of the file with the others:
// import { ..., extractCVSectionTokens, parseDurationToYears } from './ats-score'

const MOCK_CV: CVDocumentContent = {
  version: 1,
  sections: [
    {
      id: 's1', type: 'skills', visible: true,
      data: { items: ['TypeScript', 'React', 'Node.js'] },
    },
    {
      id: 's2', type: 'tools', visible: true,
      data: { items: ['Docker', 'AWS'] },
    },
    {
      id: 's3', type: 'experience', visible: true,
      data: {
        company: 'Acme Corp', titles: ['Senior Software Engineer'],
        location: 'London', duration: 'Jan 2020 – Dec 2023',
        description: 'Led backend services migration to microservices.',
        outcomes: ['Reduced latency by 40%', 'Introduced TypeScript across the team'],
      },
    },
    {
      id: 's4', type: 'experience', visible: false,
      data: {
        company: 'Hidden Corp', titles: ['Junior Developer'],
        location: 'London', duration: '2018 – 2019',
        description: 'Hidden content.',
        outcomes: [],
      },
    },
  ],
}

describe('extractCVSectionTokens', () => {
  it('extracts skills with weight 1.0', () => {
    const tokens = extractCVSectionTokens(MOCK_CV)
    const skillToken = tokens.find(t => t.text === 'typescript' && t.sectionType === 'skills')
    expect(skillToken).toBeDefined()
    expect(skillToken?.weight).toBe(1.0)
  })

  it('extracts tools with weight 1.0', () => {
    const tokens = extractCVSectionTokens(MOCK_CV)
    const toolToken = tokens.find(t => t.text === 'docker' && t.sectionType === 'tools')
    expect(toolToken).toBeDefined()
    expect(toolToken?.weight).toBe(1.0)
  })

  it('extracts experience titles with weight 0.9', () => {
    const tokens = extractCVSectionTokens(MOCK_CV)
    const titleTokens = tokens.filter(t => t.sectionType === 'exp-title')
    expect(titleTokens.some(t => t.text.includes('senior software engineer'))).toBe(true)
    expect(titleTokens[0]?.weight).toBe(0.9)
  })

  it('excludes non-visible sections', () => {
    const tokens = extractCVSectionTokens(MOCK_CV)
    expect(tokens.some(t => t.text.includes('hidden'))).toBe(false)
  })
})

describe('parseDurationToYears', () => {
  it('parses month-year range', () => {
    const years = parseDurationToYears('Jan 2020 – Dec 2023')
    expect(years).toBeCloseTo(3.9, 0)
  })

  it('handles "present" as end date', () => {
    const years = parseDurationToYears('Jan 2020 – Present')
    expect(years).toBeGreaterThan(0)
  })

  it('parses year-only range using midpoint', () => {
    const years = parseDurationToYears('2018 – 2022')
    expect(years).toBeCloseTo(4, 0)
  })

  it('returns 0 for unparseable strings', () => {
    expect(parseDurationToYears('unknown')).toBe(0)
  })
})
```

- [ ] **Step 3.2: Run tests — confirm new tests fail**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

Expected: new `extractCVSectionTokens` and `parseDurationToYears` tests fail.

- [ ] **Step 3.3: Add CV extraction to `src/modules/cv/ats-score.ts`**

Append after the JD parsing section:

```typescript
// ── CV text extraction ────────────────────────────────────────────────────────

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
```

Also add the import at the top of `ats-score.test.ts` — update the import line to include the new exports:

```typescript
import {
  normalizeText,
  tokenize,
  extractJDKeywords,
  extractJDTitle,
  extractJDYearsRequired,
  extractCVSectionTokens,
  parseDurationToYears,
} from './ats-score'
```

- [ ] **Step 3.4: Run tests — confirm passing**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

Expected: all tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/modules/cv/ats-score.ts src/modules/cv/ats-score.test.ts
git commit -m "feat(ats): add CV section token extraction and duration parser"
```

---

## Task 4: Dimension 1 — Keyword Coverage

**Files:**
- Modify: `src/modules/cv/ats-score.ts`
- Modify: `src/modules/cv/ats-score.test.ts`

- [ ] **Step 4.1: Add failing tests**

Append to `src/modules/cv/ats-score.test.ts`:

```typescript
// Also update the top import to include: scoreKeywordCoverage

describe('scoreKeywordCoverage', () => {
  const cvContent: CVDocumentContent = {
    version: 1,
    sections: [
      { id: 's1', type: 'skills', visible: true, data: { items: ['TypeScript', 'React'] } },
      { id: 's2', type: 'tools', visible: true, data: { items: ['Docker'] } },
      {
        id: 's3', type: 'experience', visible: true,
        data: {
          company: 'Acme', titles: ['Senior Software Engineer'],
          location: 'London', duration: 'Jan 2020 – Dec 2023',
          description: 'Built microservices with Node.js.',
          outcomes: ['Led team of 5 engineers'],
        },
      },
    ],
  }

  it('matches required keywords in skills section', () => {
    const result = scoreKeywordCoverage(cvContent, ['typescript', 'react'], [], [])
    expect(result.matchedRequired.some(m => m.keyword === 'typescript')).toBe(true)
    expect(result.score).toBeGreaterThan(50)
  })

  it('reports missing required keywords', () => {
    const result = scoreKeywordCoverage(cvContent, ['typescript', 'kubernetes'], [], [])
    expect(result.missingRequired).toContain('kubernetes')
  })

  it('matches implied keywords at half weight', () => {
    const result = scoreKeywordCoverage(cvContent, [], [], ['docker'])
    expect(result.matchedImplied.some(m => m.keyword === 'docker')).toBe(true)
  })

  it('returns 100 when CV matches all required keywords', () => {
    const result = scoreKeywordCoverage(cvContent, ['typescript'], [], [])
    expect(result.score).toBe(100)
  })

  it('returns 0 when no keywords match', () => {
    const result = scoreKeywordCoverage(cvContent, ['cobol', 'fortran'], [], [])
    expect(result.score).toBe(0)
  })
})
```

- [ ] **Step 4.2: Run tests — confirm they fail**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

- [ ] **Step 4.3: Add `scoreKeywordCoverage` to `ats-score.ts`**

Append after the CV extraction section:

```typescript
// ── Keyword matching helper ───────────────────────────────────────────────────

function keywordMatchesToken(keyword: string, token: SectionToken): boolean {
  const kw = normalizeText(keyword)
  const text = token.text
  if (kw.length < 3) return false
  // Word-boundary match using regex to avoid substring false positives
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`).test(text)
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

// ── Dimension 1: Keyword Coverage ────────────────────────────────────────────

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

  const requiredScore = totalRequired === 0
    ? 1
    : matchedRequired.reduce((s, m) => s + m.sectionWeight, 0) / totalRequired

  const preferredExplicitScore = totalPreferred === 0
    ? 1
    : matchedPreferred.reduce((s, m) => s + m.sectionWeight, 0) / totalPreferred

  const impliedScore = totalImplied === 0
    ? 1
    : matchedImplied.length / totalImplied * 0.5

  const preferredScore = totalPreferred === 0 && totalImplied === 0
    ? 1
    : preferredExplicitScore * 0.75 + impliedScore * 0.25

  const raw = (requiredScore * 0.70 + preferredScore * 0.30) * 100
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
```

Update the test file import to include `scoreKeywordCoverage`.

- [ ] **Step 4.4: Run tests**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

Expected: all tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add src/modules/cv/ats-score.ts src/modules/cv/ats-score.test.ts
git commit -m "feat(ats): add keyword coverage dimension scorer"
```

---

## Task 5: Dimension 2 — Title Alignment

**Files:**
- Modify: `src/modules/cv/ats-score.ts`
- Modify: `src/modules/cv/ats-score.test.ts`

- [ ] **Step 5.1: Add failing tests**

Append to `src/modules/cv/ats-score.test.ts`:

```typescript
// Update top import to include: scoreTitleAlignment

describe('scoreTitleAlignment', () => {
  const cvWithTitle: CVDocumentContent = {
    version: 1,
    sections: [
      {
        id: 's1', type: 'experience', visible: true,
        data: {
          company: 'Acme', titles: ['Senior Software Engineer'],
          location: 'London', duration: 'Jan 2020 – Present',
          description: '', outcomes: [],
        },
      },
    ],
  }

  it('scores 100 for identical titles', () => {
    const result = scoreTitleAlignment(cvWithTitle, 'Senior Software Engineer')
    expect(result.score).toBe(100)
  })

  it('scores high for closely related titles', () => {
    const result = scoreTitleAlignment(cvWithTitle, 'Senior Backend Engineer')
    expect(result.score).toBeGreaterThan(50)
  })

  it('scores 50 when jdTitle is null', () => {
    const result = scoreTitleAlignment(cvWithTitle, null)
    expect(result.score).toBe(50)
  })

  it('populates jdTitle and cvTitle', () => {
    const result = scoreTitleAlignment(cvWithTitle, 'Lead Engineer')
    expect(result.jdTitle).toBe('Lead Engineer')
    expect(result.cvTitle).toBe('Senior Software Engineer')
  })

  it('scores 0 for completely unrelated titles', () => {
    const result = scoreTitleAlignment(cvWithTitle, 'Chief Financial Officer')
    expect(result.score).toBe(0)
  })
})
```

- [ ] **Step 5.2: Run tests — confirm they fail**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

- [ ] **Step 5.3: Add `scoreTitleAlignment` to `ats-score.ts`**

Append:

```typescript
// ── Dimension 2: Title Alignment ─────────────────────────────────────────────

export function scoreTitleAlignment(
  cvContent: CVDocumentContent,
  jdTitle: string | null,
): TitleAlignmentDetail {
  const WEIGHT = 0.20

  const mostRecentExp = cvContent.sections
    .filter(s => s.visible && s.type === 'experience')
    .at(0)

  const cvTitle = mostRecentExp?.type === 'experience'
    ? mostRecentExp.data.titles[0] ?? null
    : null

  if (!jdTitle || !cvTitle) {
    return {
      score: 50, weight: WEIGHT, weightedContribution: 50 * WEIGHT,
      jdTitle: jdTitle ?? null, cvTitle: cvTitle ?? null, matchedTokens: [],
    }
  }

  const jdTokens = new Set(tokenize(jdTitle))
  const cvTokens = new Set(tokenize(cvTitle))

  const intersection = [...jdTokens].filter(t => cvTokens.has(t))
  const union = new Set([...jdTokens, ...cvTokens])

  const jaccard = union.size === 0 ? 0 : intersection.length / union.size
  const score = Math.round(jaccard * 100)

  return {
    score,
    weight: WEIGHT,
    weightedContribution: score * WEIGHT,
    jdTitle,
    cvTitle,
    matchedTokens: intersection,
  }
}
```

Update import in test file to include `scoreTitleAlignment`.

- [ ] **Step 5.4: Run tests**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

Expected: all tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add src/modules/cv/ats-score.ts src/modules/cv/ats-score.test.ts
git commit -m "feat(ats): add title alignment dimension scorer"
```

---

## Task 6: Dimension 3 — Section Completeness

**Files:**
- Modify: `src/modules/cv/ats-score.ts`
- Modify: `src/modules/cv/ats-score.test.ts`

- [ ] **Step 6.1: Add failing tests**

Append to `src/modules/cv/ats-score.test.ts`:

```typescript
// Update top import to include: scoreSectionCompleteness

describe('scoreSectionCompleteness', () => {
  it('scores 100 when no sections expected', () => {
    const cv: CVDocumentContent = { version: 1, sections: [] }
    const result = scoreSectionCompleteness(cv, 'We are looking for a great team member.')
    expect(result.score).toBe(100)
  })

  it('expects skills or tools for technical JDs', () => {
    const cv: CVDocumentContent = { version: 1, sections: [] }
    const result = scoreSectionCompleteness(cv, 'We need a senior software engineer with React.')
    expect(result.expectedSections.some(s => s === 'skills' || s === 'tools')).toBe(true)
  })

  it('scores 100 when all expected sections are present and visible', () => {
    const cv: CVDocumentContent = {
      version: 1,
      sections: [
        { id: 's1', type: 'skills', visible: true, data: { items: ['TypeScript'] } },
      ],
    }
    const result = scoreSectionCompleteness(cv, 'Senior software engineer with TypeScript required.')
    const expected = result.expectedSections.filter(s => s === 'skills' || s === 'tools')
    const present = result.presentSections
    expect(expected.every(s => present.includes(s))).toBe(true)
  })

  it('scores lower when expected sections are missing', () => {
    const cv: CVDocumentContent = { version: 1, sections: [] }
    const result = scoreSectionCompleteness(cv, 'Senior software engineer with React required.')
    expect(result.score).toBeLessThan(100)
    expect(result.missingSections.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 6.2: Run tests — confirm they fail**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

- [ ] **Step 6.3: Add `scoreSectionCompleteness` to `ats-score.ts`**

Append:

```typescript
// ── Dimension 3: Section Completeness ────────────────────────────────────────

export function scoreSectionCompleteness(
  cvContent: CVDocumentContent,
  jdText: string,
): SectionCompletenessDetail {
  const WEIGHT = 0.20
  const expectedSections = inferExpectedSections(jdText)

  if (expectedSections.length === 0) {
    return {
      score: 100, weight: WEIGHT, weightedContribution: 100 * WEIGHT,
      expectedSections: [], presentSections: [], missingSections: [],
    }
  }

  const visibleTypes = new Set(
    cvContent.sections.filter(s => s.visible).map(s => s.type),
  )

  const presentSections: string[] = []
  const missingSections: string[] = []

  for (const expected of expectedSections) {
    // skills and tools are interchangeable for completeness purposes
    const found = expected === 'skills'
      ? visibleTypes.has('skills') || visibleTypes.has('tools')
      : expected === 'tools'
      ? visibleTypes.has('tools') || visibleTypes.has('skills')
      : visibleTypes.has(expected as CVDocumentContent['sections'][number]['type'])

    if (found) presentSections.push(expected)
    else missingSections.push(expected)
  }

  const score = Math.round((presentSections.length / expectedSections.length) * 100)

  return {
    score,
    weight: WEIGHT,
    weightedContribution: score * WEIGHT,
    expectedSections,
    presentSections,
    missingSections,
  }
}
```

Update test import to include `scoreSectionCompleteness`.

- [ ] **Step 6.4: Run tests**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

Expected: all tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add src/modules/cv/ats-score.ts src/modules/cv/ats-score.test.ts
git commit -m "feat(ats): add section completeness dimension scorer"
```

---

## Task 7: Dimension 4 — Seniority Signal

**Files:**
- Modify: `src/modules/cv/ats-score.ts`
- Modify: `src/modules/cv/ats-score.test.ts`

- [ ] **Step 7.1: Add failing tests**

Append to `src/modules/cv/ats-score.test.ts`:

```typescript
// Update top import to include: scoreSenioritySignal

describe('scoreSenioritySignal', () => {
  const cvWithExperience: CVDocumentContent = {
    version: 1,
    sections: [
      {
        id: 's1', type: 'experience', visible: true,
        data: {
          company: 'Acme', titles: ['Senior Engineer'],
          location: 'London', duration: 'Jan 2018 – Dec 2022',
          description: '', outcomes: [],
        },
      },
      {
        id: 's2', type: 'experience', visible: true,
        data: {
          company: 'Beta', titles: ['Junior Developer'],
          location: 'London', duration: 'Jan 2016 – Dec 2017',
          description: '', outcomes: [],
        },
      },
    ],
  }

  it('scores 100 when CV years exceed JD requirement', () => {
    const result = scoreSenioritySignal(cvWithExperience, 'Minimum 3 years experience required.')
    expect(result.score).toBe(100)
    expect(result.seniorityBasis).toBe('years')
  })

  it('scores proportionally when CV years are below requirement', () => {
    const result = scoreSenioritySignal(cvWithExperience, 'Minimum 10 years experience required.')
    expect(result.score).toBeLessThan(100)
    expect(result.jdRequiredYears).toBe(10)
  })

  it('uses keyword matching when no year requirement found', () => {
    const result = scoreSenioritySignal(cvWithExperience, 'We need a senior software engineer.')
    expect(result.seniorityBasis).toBe('keywords')
    expect(result.score).toBe(100)
  })

  it('returns neutral score when no year requirement and no seniority keywords', () => {
    const result = scoreSenioritySignal(cvWithExperience, 'We need a great communicator.')
    expect(result.seniorityBasis).toBe('neutral')
    expect(result.score).toBe(60)
  })

  it('reports total CV years', () => {
    const result = scoreSenioritySignal(cvWithExperience, 'Minimum 3 years required.')
    // 2018–2022 = ~4y + 2016–2017 = ~1y → ~5–6y total
    expect(result.cvTotalYears).toBeGreaterThan(4)
  })
})
```

- [ ] **Step 7.2: Run tests — confirm they fail**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

- [ ] **Step 7.3: Add `scoreSenioritySignal` to `ats-score.ts`**

Append:

```typescript
// ── Dimension 4: Seniority Signal ────────────────────────────────────────────

export function scoreSenioritySignal(
  cvContent: CVDocumentContent,
  jdText: string,
): SenioritySignalDetail {
  const WEIGHT = 0.15

  const cvTotalYears = cvContent.sections
    .filter(s => s.visible && s.type === 'experience')
    .reduce((sum, s) => {
      if (s.type !== 'experience') return sum
      return sum + parseDurationToYears(s.data.duration)
    }, 0)

  const jdRequiredYears = extractJDYearsRequired(jdText)

  if (jdRequiredYears !== null) {
    const score = Math.min(100, Math.round((cvTotalYears / jdRequiredYears) * 100))
    return {
      score, weight: WEIGHT, weightedContribution: score * WEIGHT,
      jdRequiredYears, cvTotalYears, seniorityBasis: 'years',
    }
  }

  // Keyword-based seniority matching
  const jdSeniorityLevel = extractJDSeniorityLevel(jdText)
  const cvSeniorityLevel = extractJDSeniorityLevel(
    cvContent.sections
      .filter(s => s.visible && s.type === 'experience')
      .flatMap(s => s.type === 'experience' ? s.data.titles : [])
      .join(' '),
  )

  if (jdSeniorityLevel === null || cvSeniorityLevel === null) {
    return {
      score: 60, weight: WEIGHT, weightedContribution: 60 * WEIGHT,
      jdRequiredYears: null, cvTotalYears, seniorityBasis: 'neutral',
    }
  }

  const diff = Math.abs(jdSeniorityLevel - cvSeniorityLevel)
  const score = diff === 0 ? 100 : diff === 1 ? 70 : 40

  return {
    score, weight: WEIGHT, weightedContribution: score * WEIGHT,
    jdRequiredYears: null, cvTotalYears, seniorityBasis: 'keywords',
  }
}
```

Update test import to include `scoreSenioritySignal`.

- [ ] **Step 7.4: Run tests**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

Expected: all tests pass.

- [ ] **Step 7.5: Commit**

```bash
git add src/modules/cv/ats-score.ts src/modules/cv/ats-score.test.ts
git commit -m "feat(ats): add seniority signal dimension scorer"
```

---

## Task 8: Score aggregation — `scoreATS`

**Files:**
- Modify: `src/modules/cv/ats-score.ts`
- Modify: `src/modules/cv/ats-score.test.ts`

- [ ] **Step 8.1: Add failing integration test**

Append to `src/modules/cv/ats-score.test.ts`:

```typescript
// Update top import to include: scoreATS

describe('scoreATS (integration)', () => {
  const wellMatchedCV: CVDocumentContent = {
    version: 1,
    sections: [
      { id: 's1', type: 'skills', visible: true, data: { items: ['TypeScript', 'React', 'Node.js', 'GraphQL'] } },
      { id: 's2', type: 'tools', visible: true, data: { items: ['Docker', 'AWS', 'PostgreSQL'] } },
      {
        id: 's3', type: 'experience', visible: true,
        data: {
          company: 'Acme', titles: ['Senior Software Engineer'],
          location: 'London', duration: 'Jan 2019 – Present',
          description: 'Led backend development using TypeScript and Node.js.',
          outcomes: ['Reduced API latency by 40%', 'Introduced React component library'],
        },
      },
    ],
  }

  const matchingJD = `
    Job Title: Senior Software Engineer

    We are looking for a Senior Software Engineer with 5+ years of experience.

    Requirements (must have):
    - TypeScript required
    - React is required
    - Node.js experience essential

    Nice to have:
    - Docker preferred
    - GraphQL is a bonus
  `

  it('returns a finalScore between 0 and 100', () => {
    const result = scoreATS(wellMatchedCV, matchingJD, [])
    expect(result.finalScore).toBeGreaterThanOrEqual(0)
    expect(result.finalScore).toBeLessThanOrEqual(100)
  })

  it('produces a high score for a well-matched CV', () => {
    const result = scoreATS(wellMatchedCV, matchingJD, [])
    expect(result.finalScore).toBeGreaterThan(70)
  })

  it('assigns the correct label', () => {
    const result = scoreATS(wellMatchedCV, matchingJD, [])
    expect(['poor', 'fair', 'good', 'strong', 'excellent']).toContain(result.label)
  })

  it('weighted contributions sum to finalScore', () => {
    const result = scoreATS(wellMatchedCV, matchingJD, [])
    const sumContributions = Object.values(result.dimensions)
      .reduce((s, d) => s + d.weightedContribution, 0)
    expect(Math.round(sumContributions)).toBe(result.finalScore)
  })

  it('produces a poor score for an unrelated CV', () => {
    const mismatchedCV: CVDocumentContent = {
      version: 1,
      sections: [
        { id: 's1', type: 'skills', visible: true, data: { items: ['Photoshop', 'Illustrator', 'InDesign'] } },
        {
          id: 's2', type: 'experience', visible: true,
          data: {
            company: 'Design Co', titles: ['Graphic Designer'],
            location: 'London', duration: 'Jan 2020 – Present',
            description: 'Brand design and print production.',
            outcomes: [],
          },
        },
      ],
    }
    const result = scoreATS(mismatchedCV, matchingJD, [])
    expect(result.finalScore).toBeLessThan(50)
  })
})
```

- [ ] **Step 8.2: Run tests — confirm they fail**

```bash
npm test -- src/modules/cv/ats-score.test.ts
```

- [ ] **Step 8.3: Add `scoreATS` to `ats-score.ts`**

Append at the end of the file:

```typescript
// ── Score aggregation ─────────────────────────────────────────────────────────

function deriveLabel(score: number): ATSScoreBreakdown['label'] {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'strong'
  if (score >= 55) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
}

export function scoreATS(
  cvContent: CVDocumentContent,
  jobDescription: string,
  impliedKeywords: string[],
): ATSScoreBreakdown {
  const { required, preferred } = extractJDKeywords(jobDescription)
  const jdTitle = extractJDTitle(jobDescription)

  const keywordCoverage = scoreKeywordCoverage(cvContent, required, preferred, impliedKeywords)
  const titleAlignment = scoreTitleAlignment(cvContent, jdTitle)
  const sectionCompleteness = scoreSectionCompleteness(cvContent, jobDescription)
  const senioritySignal = scoreSenioritySignal(cvContent, jobDescription)

  const finalScore = Math.round(
    keywordCoverage.weightedContribution +
    titleAlignment.weightedContribution +
    sectionCompleteness.weightedContribution +
    senioritySignal.weightedContribution,
  )

  return {
    finalScore: Math.min(100, Math.max(0, finalScore)),
    label: deriveLabel(finalScore),
    dimensions: { keywordCoverage, titleAlignment, sectionCompleteness, senioritySignal },
  }
}
```

Update test import to include `scoreATS`.

- [ ] **Step 8.4: Run all engine tests**

```bash
npm test -- src/modules/cv/ats-score.test.ts src/modules/cv/ats-score-schema.test.ts
```

Expected: all tests pass.

- [ ] **Step 8.5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 8.6: Commit**

```bash
git add src/modules/cv/ats-score.ts src/modules/cv/ats-score.test.ts
git commit -m "feat(ats): add scoreATS aggregation — deterministic engine complete"
```

---

## Task 9: Server action

**Files:**
- Create: `src/modules/cv/ats-score-action.ts`

No new tests for the action — it's a thin orchestration layer over already-tested units. The LLM calls follow the same fire-and-forget-on-failure pattern used throughout this codebase.

- [ ] **Step 9.1: Create `src/modules/cv/ats-score-action.ts`**

```typescript
'use server'

import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { completeStructured } from '@/modules/llm/client'
import { buildProfileSnapshot, serializeProfileForLLM } from '@/modules/profile/snapshot'
import { LLMError } from '@/modules/llm/errors'
import { parseCVContent } from './schema'
import { scoreATS } from './ats-score'
import {
  ATSInterpretationSchema,
  ImpliedKeywordsSchema,
  type ATSScoreResult,
  type ATSInterpretation,
} from './ats-score-schema'

type RunATSScoreResult =
  | { ok: true; result: ATSScoreResult }
  | { ok: false; error: 'not_found' | 'no_job_description' | 'no_cv_content' | 'not_configured' | string; message: string }

export async function runATSScore(cvDocumentId: string): Promise<RunATSScoreResult> {
  const { profile } = await requireProfile()

  const cvDoc = await prisma.cVDocument.findFirst({
    where: { id: cvDocumentId, profileId: profile.id },
    select: {
      generatedContent: true,
      jobDescription: true,
      jobApplicationId: true,
    },
  })

  if (!cvDoc) {
    return { ok: false, error: 'not_found', message: 'CV document not found.' }
  }

  // CVDocument.jobDescription is preferred; fall back to the linked JobApplication's JD.
  let jobDescription = cvDoc.jobDescription?.trim() ?? ''
  if (!jobDescription && cvDoc.jobApplicationId) {
    const jobApp = await prisma.jobApplication.findFirst({
      where: { id: cvDoc.jobApplicationId, profileId: profile.id },
      select: { jobDescription: true },
    })
    jobDescription = jobApp?.jobDescription?.trim() ?? ''
  }

  if (!jobDescription) {
    return {
      ok: false,
      error: 'no_job_description',
      message: 'No job description attached to this CV — ATS scoring requires a target job.',
    }
  }

  const cvContent = parseCVContent(cvDoc.generatedContent)
  if (cvContent.sections.length === 0) {
    return { ok: false, error: 'no_cv_content', message: 'CV has no content to score.' }
  }

  // Step 1: implied keyword expansion (small LLM call — non-fatal if it fails)
  let impliedKeywords: string[] = []
  try {
    const expansion = await completeStructured(
      profile.id,
      `Job Description:\n\n${jobDescription}`,
      ImpliedKeywordsSchema,
      {
        system: [
          'You are an ATS (Applicant Tracking System) expert.',
          'Given a job description, list 10–20 unstated/implied keywords that an ATS would',
          'typically score candidates against for this type of role.',
          'Include adjacent skills, common tool pairings, and role-typical competencies',
          'not explicitly mentioned in the JD.',
          'Do NOT include keywords already stated in the JD.',
        ].join(' '),
        feature: 'ats-keyword-expand',
        maxOutputTokens: 300,
        temperature: 0.1,
      },
    )
    impliedKeywords = expansion.object.keywords
  } catch {
    // Non-fatal — continue without implied keywords
  }

  // Step 2: deterministic scoring (always succeeds)
  const breakdown = scoreATS(cvContent, jobDescription, impliedKeywords)

  // Step 3: AI interpretation (non-fatal if LLM not configured or fails)
  let interpretation: ATSInterpretation | null = null
  try {
    const [snapshot] = await Promise.all([buildProfileSnapshot(profile.id)])
    const profileText = serializeProfileForLLM(snapshot)

    const { dimensions: d } = breakdown
    const userMessage = [
      '== ATS SCORE BREAKDOWN ==',
      `Final score: ${breakdown.finalScore}/100 (${breakdown.label})`,
      '',
      `Keyword coverage (${Math.round(d.keywordCoverage.score)}/100)`,
      `  Missing required: ${d.keywordCoverage.missingRequired.join(', ') || 'none'}`,
      `  Missing preferred: ${d.keywordCoverage.missingPreferred.join(', ') || 'none'}`,
      `  Missing implied: ${d.keywordCoverage.missingImplied.join(', ') || 'none'}`,
      '',
      `Title alignment (${Math.round(d.titleAlignment.score)}/100)`,
      `  JD title: ${d.titleAlignment.jdTitle ?? 'not found'}`,
      `  CV title: ${d.titleAlignment.cvTitle ?? 'not found'}`,
      '',
      `Section completeness (${Math.round(d.sectionCompleteness.score)}/100)`,
      `  Missing: ${d.sectionCompleteness.missingSections.join(', ') || 'none'}`,
      '',
      `Seniority signal (${Math.round(d.senioritySignal.score)}/100)`,
      `  JD required years: ${d.senioritySignal.jdRequiredYears ?? 'not specified'}`,
      `  CV total years: ${d.senioritySignal.cvTotalYears.toFixed(1)}`,
      '',
      '== CANDIDATE PROFILE ==',
      profileText,
    ].join('\n')

    const result = await completeStructured(profile.id, userMessage, ATSInterpretationSchema, {
      system: [
        'You are an ATS scoring expert helping a candidate improve their CV.',
        'Analyse the provided score breakdown and candidate profile.',
        '1. Write a 2–3 sentence summary explaining the score — be specific, not generic.',
        '2. Write one sentence per dimension explaining its sub-score.',
        '3. Identify profileOpportunities: items in the candidate PROFILE not in the CV',
        '   that would improve the score. ONLY include items verifiably present in the',
        '   == CANDIDATE PROFILE == section. Do not invent skills the candidate lacks.',
      ].join(' '),
      feature: 'ats-interpret',
      maxOutputTokens: 600,
      temperature: 0.2,
    })
    interpretation = result.object
  } catch (err) {
    if (err instanceof LLMError && err.kind === 'not_configured') {
      return { ok: false, error: 'not_configured', message: err.message }
    }
    // Other LLM errors: return score without interpretation rather than failing
  }

  return { ok: true, result: { breakdown, interpretation, impliedKeywords } }
}
```

- [ ] **Step 9.2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 9.3: Commit**

```bash
git add src/modules/cv/ats-score-action.ts
git commit -m "feat(ats): add server action orchestrating keyword expansion, scoring, and interpretation"
```

---

## Task 10: Chat coach integration

**Files:**
- Modify: `src/modules/chat/schema.ts`
- Modify: `src/modules/chat/context.ts`

- [ ] **Step 10.1: Extend `src/modules/chat/schema.ts`**

Add `atsScore` to the `cv` variant of `PageContextSchema`. Find the `cv` object in the discriminated union and add one optional field:

```typescript
// Before (in the discriminatedUnion):
z.object({
  type: z.literal('cv'),
  cvId: z.string(),
  title: z.string(),
  company: z.string().optional(),
}),

// After:
z.object({
  type: z.literal('cv'),
  cvId: z.string(),
  title: z.string(),
  company: z.string().optional(),
  atsScore: z.string().optional(),
}),
```

- [ ] **Step 10.2: Extend `formatPageContext` in `src/modules/chat/context.ts`**

Find the `case 'cv':` block in `formatPageContext`. Replace it:

```typescript
case 'cv': {
  let text =
    `User is reviewing CV: "${ctx.title}"${ctx.company ? ` (for ${ctx.company})` : ''}\n` +
    `CV ID: ${ctx.cvId} — use this with get_cv_document to fetch full content`
  if (ctx.atsScore) {
    text +=
      `\n\n<ats_score>\n${ctx.atsScore}\n</ats_score>\n` +
      `The user has run an ATS check on this CV. Reference the breakdown above when advising ` +
      `on CV improvements. Use propose_cv_update to suggest specific section changes. ` +
      `Only recommend adding content that exists in the user's profile — do not suggest ` +
      `fabricating skills or experience the candidate does not have.`
  }
  return text
}
```

- [ ] **Step 10.3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors. If `PageContext` is used elsewhere with the `cv` type, TypeScript will still compile — `atsScore` is optional.

- [ ] **Step 10.4: Commit**

```bash
git add src/modules/chat/schema.ts src/modules/chat/context.ts
git commit -m "feat(ats): extend cv PageContext with atsScore for chat coach integration"
```

---

## Task 11: ATS Score Panel UI

**Files:**
- Create: `src/app/dashboard/cv-builder/[id]/_components/ats-score-panel.tsx`
- Modify: `src/app/dashboard/cv-builder/[id]/_components/cv-editor.tsx`

- [ ] **Step 11.1: Create `ats-score-panel.tsx`**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { ShieldCheck, Loader2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { runATSScore } from '@/modules/cv/ats-score-action'
import { serializeATSScoreForContext } from '@/modules/cv/ats-score-schema'
import { usePageContext } from '@/lib/context/page-context'
import type { ATSScoreResult } from '@/modules/cv/ats-score-schema'

type Props = {
  cvId: string
  cvTitle: string
  cvCompany?: string | null
  hasJobDescription: boolean
}

const LABEL_COLORS: Record<string, string> = {
  excellent: 'text-emerald-600',
  strong:    'text-green-600',
  good:      'text-amber-600',
  fair:      'text-orange-500',
  poor:      'text-red-500',
}

const DIMENSION_LABELS: Record<string, string> = {
  keywordCoverage:     'Keyword Coverage',
  titleAlignment:      'Title Alignment',
  sectionCompleteness: 'Section Completeness',
  senioritySignal:     'Seniority Signal',
}

export function ATSScorePanel({ cvId, cvTitle, cvCompany, hasJobDescription }: Props) {
  const [result, setResult] = useState<ATSScoreResult | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { context, setContext, openPanel } = usePageContext()

  function handleRun() {
    startTransition(async () => {
      const res = await runATSScore(cvId)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      setResult(res.result)
      setShowDetail(true)
    })
  }

  function handleDiscussWithCoach() {
    if (!result) return
    setContext({
      type: 'cv',
      cvId,
      title: cvTitle,
      company: cvCompany ?? undefined,
      atsScore: serializeATSScoreForContext(result),
    })
    openPanel()
  }

  const { breakdown } = result ?? {}

  return (
    <div className="flex flex-col gap-3">
      {/* Trigger */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRun}
          disabled={isPending || !hasJobDescription}
          title={!hasJobDescription ? 'Attach a job description to enable ATS scoring' : undefined}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isPending
            ? <Loader2 className="size-3.5 animate-spin" />
            : <ShieldCheck className="size-3.5" />}
          {isPending ? 'Checking…' : result ? 'Re-check ATS' : 'Run ATS Check'}
        </button>

        {result && (
          <button
            onClick={handleDiscussWithCoach}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <MessageSquare className="size-3.5" />
            Discuss with coach
          </button>
        )}
      </div>

      {/* Score display */}
      {breakdown && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums">{breakdown.finalScore}</span>
              <span className="text-sm text-muted-foreground">/100</span>
              <span className={`text-sm font-medium capitalize ${LABEL_COLORS[breakdown.label] ?? ''}`}>
                {breakdown.label}
              </span>
            </div>
            <button
              onClick={() => setShowDetail(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showDetail ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {showDetail ? 'Hide' : 'Details'}
            </button>
          </div>

          {/* Score bar */}
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-foreground/70 transition-all"
              style={{ width: `${breakdown.finalScore}%` }}
            />
          </div>

          {/* Dimension breakdown */}
          {showDetail && (
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              {(Object.entries(breakdown.dimensions) as [keyof typeof breakdown.dimensions, typeof breakdown.dimensions[keyof typeof breakdown.dimensions]][]).map(([key, dim]) => (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{DIMENSION_LABELS[key]}</span>
                    <span className="font-medium tabular-nums">{Math.round(dim.score)}</span>
                  </div>
                  <div className="mt-0.5 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-foreground/50"
                      style={{ width: `${Math.round(dim.score)}%` }}
                    />
                  </div>
                </div>
              ))}

              {/* Missing required keywords */}
              {breakdown.dimensions.keywordCoverage.missingRequired.length > 0 && (
                <div className="mt-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Missing required keywords
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {breakdown.dimensions.keywordCoverage.missingRequired.map(kw => (
                      <span
                        key={kw}
                        className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI interpretation */}
              {result?.interpretation && (
                <div className="mt-1 border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {result.interpretation.summary}
                  </p>
                  {result.interpretation.profileOpportunities.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Profile opportunities
                      </p>
                      {result.interpretation.profileOpportunities.map((opp, i) => (
                        <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                          <span className="font-medium">{opp.asset}</span> → {opp.targetSection}: {opp.rationale}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 11.2: Add ATS panel to `cv-editor.tsx`**

In `src/app/dashboard/cv-builder/[id]/_components/cv-editor.tsx`:

**a)** Add the import at the top with other component imports:

```typescript
import { ATSScorePanel } from './ats-score-panel'
```

**b)** Add `atsPanelOpen` state alongside the existing panel states (after `const [jobPanelOpen, setJobPanelOpen] = useState(false)`):

```typescript
const [atsPanelOpen, setAtsPanelOpen] = useState(false)
```

**c)** Add the "ATS" toolbar button in the toolbar `div`, after the "Discuss" button (after the `<button onClick={openPanel}...>Discuss</button>` block):

```typescript
<button
  onClick={() => setAtsPanelOpen(o => !o)}
  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
>
  ATS ▸
</button>
```

**d)** Add the ATS panel to the body section alongside the existing job panel. After the closing `</div>` of the `jobPanelOpen` block, add:

```typescript
{atsPanelOpen && (
  <div className="absolute inset-y-0 right-0 z-10 flex w-[42%] min-w-[260px] max-w-[480px] flex-col border-l bg-background overflow-y-auto p-4 print:hidden">
    <div className="mb-3 flex items-center justify-between">
      <span className="text-sm font-semibold">ATS Score</span>
      <button
        type="button"
        onClick={() => setAtsPanelOpen(false)}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Close ATS panel"
      >
        <X className="size-4" />
      </button>
    </div>
    <ATSScorePanel
      cvId={cv.id}
      cvTitle={cv.jobTitle ?? 'CV'}
      cvCompany={cv.company}
      hasJobDescription={!!(cv.jobApplication?.jobDescription)}
    />
  </div>
)}
```

- [ ] **Step 11.3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 11.4: Start the dev server and smoke-test**

```bash
npm run dev
```

1. Navigate to `/dashboard/cv-builder/<id>` for a CV that has a job application with a JD.
2. Confirm the **ATS ▸** toolbar button appears.
3. Click it — the ATS panel slides open.
4. Click **Run ATS Check** — loading spinner shows, score renders after the call.
5. Click **Details** — dimension bars and missing keywords appear.
6. Click **Discuss with coach** — chat panel opens; send a message and confirm the coach references the ATS score.
7. Navigate to a CV with no job description — confirm **Run ATS Check** is disabled (greyed out with tooltip).

- [ ] **Step 11.5: Commit**

```bash
git add src/app/dashboard/cv-builder/[id]/_components/ats-score-panel.tsx src/app/dashboard/cv-builder/[id]/_components/cv-editor.tsx
git commit -m "feat(ats): add ATS score panel UI with coach integration"
```

---

## Task 12: Usage log labels

**Files:**
- Modify: `src/app/dashboard/settings/usage/_components/usage-log.tsx`

- [ ] **Step 12.1: Add feature labels**

In `src/app/dashboard/settings/usage/_components/usage-log.tsx`, find the `FEATURE_LABELS` record and add two entries:

```typescript
'ats-keyword-expand': 'ATS — keyword expansion',
'ats-interpret':      'ATS — interpretation',
```

- [ ] **Step 12.2: Typecheck and run all tests**

```bash
npm run typecheck && npm test
```

Expected: no type errors, all tests pass.

- [ ] **Step 12.3: Commit**

```bash
git add src/app/dashboard/settings/usage/_components/usage-log.tsx
git commit -m "feat(ats): register ATS feature labels in usage log"
```

---

## Done

All tasks complete. The ATS scoring engine is:

- **Deterministic:** `scoreATS` is a pure function — no I/O, fully unit-tested per dimension
- **AI-augmented:** two targeted LLM calls (keyword expansion + interpretation), both non-fatal on failure
- **Profile-grounded:** the interpretation prompt enforces profile-only recommendations
- **Chat-integrated:** "Discuss with coach" injects the full breakdown into PageContext; the coach can drive `propose_cv_update` from there
- **Independent:** does not touch `assessJobFit`, `scanCV`, or any other existing feature
