# ATS Scoring Engine — Design Spec

**Date:** 2026-06-16
**Status:** Approved

---

## Problem

After a CV is generated, there is no signal on whether it will survive an employer's ATS filter before reaching a recruiter. The existing `scanCV` function (`src/modules/cv/scan-cv.ts`) is LLM-only, internal, fire-and-forget, and not shown to the user. It does not model how ATS systems actually score candidates.

This spec defines an on-demand, user-facing ATS scoring engine built deterministic-first, with an AI interpretation layer on top.

---

## Scope

**In scope:**
- A multi-dimensional deterministic scoring engine that evaluates a generated CV against a job description
- An LLM preprocessing step that generates implied keyword ontology per JD (industry-aware, not static)
- An LLM interpretation layer that narrates the score and surfaces profile-grounded improvement opportunities
- A CV builder UI panel with a "Run ATS Check" trigger and score display
- A "Discuss with coach" integration that passes the ATS breakdown into the chat coach's page context

**Out of scope (phase 1):**
- Persisting the ATS score to the database (React state only; `CVDocument` schema migration deferred)
- Caching the implied keyword expansion on `JobApplication` (deferred to same follow-up migration)
- Employer-configured private ATS criteria — these are genuinely opaque and no external tool can model them; surfaced as an explicit caveat to the user

---

## Architecture

The engine lives in `src/modules/cv/` as three files:

```
src/modules/cv/
  ats-score-schema.ts     ← Zod schemas + inferred TS types (no 'use server')
  ats-score.ts            ← Pure deterministic scoring engine (no I/O, no async)
  ats-score-action.ts     ← 'use server': reads DB, runs engine, calls LLM
```

Supporting changes:
```
src/modules/chat/
  schema.ts               ← extend cv PageContext with atsScore?: string
  context.ts              ← extend formatPageContext cv case

src/app/dashboard/cv-builder/[id]/_components/
  ats-score-panel.tsx     ← trigger + score display + "Discuss with coach" button
```

### Data flow

```
User clicks "Run ATS Check"
        ↓
ats-score-action.ts ('use server')
  ├─ read CVDocument (generatedContent + jobDescription) from Prisma
  ├─ read ProfileSnapshot (for AI interpretation cross-reference)
  ├─ expandImpliedKeywords(jobDescription)         ← LLM call #1: ats-keyword-expand
  │    └─ returns string[]
  ├─ scoreATS(cvContent, jobDescription, impliedKeywords)  ← pure function, no I/O
  │    └─ returns ATSScoreBreakdown
  ├─ if LLM configured:
  │    interpretATSScore(breakdown, profileSnapshot, jobDescription)  ← LLM call #2: ats-interpret
  │         └─ returns ATSInterpretation
  └─ return { breakdown, interpretation, impliedKeywords }

User clicks "Discuss with coach"
  ├─ serialise breakdown to plain text summary
  ├─ set atsScore on cv PageContext (React state)
  └─ coach sees <ats_score> block in <active_context>, uses propose_cv_update for changes
```

---

## Deterministic Scoring Engine

`scoreATS(cvContent, jobDescription, impliedKeywords)` is a pure function — same inputs always produce the same output. No side effects, no async.

### Dimension 1 — Keyword Coverage (weight: 45%)

**JD extraction:**
Tokenise and normalise the JD (lowercase, strip punctuation, lemmatise common suffixes). Extract n-grams before single tokens so `machine learning` is one unit. Classify each token as **required** or **preferred** by proximity to signal words in the same sentence:
- Required signals: `must`, `required`, `essential`, `minimum`, `necessary`
- Preferred signals: `preferred`, `nice to have`, `bonus`, `ideally`, `desirable`
- Unclassified tokens → **preferred** by default

**Implied keywords:**
The `impliedKeywords` parameter (LLM-generated, see below) is merged into the preferred bucket. Implied matches score at 50% weight of explicit matches.

**CV section weights:**

| Section type | Weight |
|---|---|
| `skills`, `tools` | 1.0 |
| `competencies`, `capabilities` | 0.9 |
| Experience `titles` | 0.9 |
| Experience `description`, `outcomes` | 0.7 |
| `profile` prose | 0.6 |
| `education`, `certification` | 0.5 |

For each keyword: find the highest-weighted CV section it appears in.

**Formula:**
```
required_score  = Σ(section_weight for matched explicit required) / max(total_required, 1)
preferred_score = Σ(section_weight for matched explicit preferred) / max(total_explicit_preferred, 1)
implied_score   = Σ(section_weight for matched implied) * 0.5 / max(total_implied, 1)

keyword_coverage = (
  required_score * 0.70 +
  (preferred_score * 0.75 + implied_score * 0.25) * 0.30
) * 100
```

**Evidence stored:** matched required (keyword + section + weight), matched preferred, matched implied (keyword + section + impliedFrom), missing required, missing preferred, missing implied.

---

### Dimension 2 — Title Alignment (weight: 20%)

Extract the JD job title from common patterns (`Job Title:`, `Role:`, `Position:`, first bolded line, or first line before the first paragraph break). Extract `titles[]` from the most recent visible experience section in the CV.

**Formula:** Jaccard similarity on normalised tokens (lowercase, stop-words removed; seniority tokens preserved — `senior`, `lead`, `principal`, `head`, `junior` carry signal).

```
title_alignment = |intersection(jd_tokens, cv_tokens)| / |union(jd_tokens, cv_tokens)| * 100
```

If no JD title can be extracted: score 50 (neutral — no penalty, no bonus).

---

### Dimension 3 — Section Completeness (weight: 20%)

Infer expected section types from JD keyword signals:
- Technical signals (programming languages, frameworks, `engineer`, `developer`) → expect `skills` or `tools`
- Leadership signals (`manage`, `reports to`, `team of`, `direct reports`) → expect `competencies` or `capabilities`
- Academic/research signals (`PhD`, `research`, `publications`) → expect prominent `education`

Check which expected sections are present (`visible: true`) in the CV.

```
if total_expected_sections === 0:
  section_completeness = 100   // guard: no role signals → no penalty
else:
  section_completeness = (present_expected_sections / total_expected_sections) * 100
```

---

### Dimension 4 — Seniority Signal (weight: 15%)

**JD extraction:** regex for explicit year requirements — `5+ years`, `minimum 3 years`, `at least 7 years`, `3-5 years`.

**CV computation:** sum duration of all visible experience sections. Parse duration strings (`Jan 2020 – Mar 2024`) to decimal years.

**Formula:**
```
if jd_requires_years:
  seniority_signal = min(cv_total_years / jd_required_years, 1.0) * 100
else:
  match seniority keywords (junior/mid/senior/lead/principal/head) between JD and CV titles
  full match = 100 | adjacent level = 70 | two levels apart = 40 | no match = 60 (neutral)
```

The `else` neutral is 60 (not 50) — absence of explicit year requirements should not penalise candidates who are broadly qualified.

---

### Score aggregation

```
finalScore = round(
  keyword_coverage     * 0.45 +
  title_alignment      * 0.20 +
  section_completeness * 0.20 +
  seniority_signal     * 0.15
)

label:
  85–100 → 'excellent'
  70–84  → 'strong'
  55–69  → 'good'
  40–54  → 'fair'
  0–39   → 'poor'
```

---

## LLM Preprocessing: Implied Keyword Expansion

**Why:** Enterprise ATS systems run JDs through skills ontologies (Lightcast, ESCO, O*NET) that expand each explicit term to implied adjacent skills. A static lookup file would be industry-specific, stale, and maintenance-heavy. Instead, one small LLM call per ATS check generates the implied keyword list for this specific JD.

**Call:**
```
Feature tag: ats-keyword-expand
Input:       jobDescription (raw text)
Output:      string[]  — implied keywords not explicitly stated in the JD

Prompt intent: "Given this JD, list the unstated/implied keywords and skills
an ATS would likely score candidates against — adjacent skills, common tool
pairings, role-typical competencies not explicitly listed."
```

**Caching:** Phase 1 — generated fresh each time the user triggers an ATS check. Phase 2 (future migration) — stored as `atsKeywords Json?` on `JobApplication` and reused across subsequent checks for the same job.

**Caveat surfaced to user:** "Implied keywords model common ATS ontology expansion and are probabilistic. Employer-configured private screening criteria (added in the ATS backend, not visible on the JD) cannot be modelled by any external tool."

---

## LLM Interpretation Layer

**Call:**
```
Feature tag: ats-interpret
Input:       ATSScoreBreakdown + ProfileSnapshot + jobDescription
Output:      ATSInterpretation
```

**Output schema:**
```ts
ATSInterpretation = {
  summary: string                       // 2–3 sentence overall narrative
  dimensionNotes: Array<{
    dimension: 'keywordCoverage' | 'titleAlignment' | 'sectionCompleteness' | 'senioritySignal'
    note: string                        // 1 sentence explanation of that dimension's score
  }>
  profileOpportunities: Array<{
    asset: string           // e.g. "Docker (skill, expert)"
    targetSection: string   // e.g. "tools"
    rationale: string       // why adding this would improve the score
  }>
}
```

**Critical constraint in the prompt:** The model may only populate `profileOpportunities` with items that exist in the provided `ProfileSnapshot`. It must not suggest skills, tools, or experience the candidate does not have. This constraint prevents hallucinated recommendations.

---

## Output Types

```ts
// Per-dimension base
type DimensionResult = {
  score: number              // 0–100
  weight: number             // e.g. 0.45
  weightedContribution: number
}

type KeywordCoverageDetail = DimensionResult & {
  matchedRequired: Array<{ keyword: string; section: string; sectionWeight: number }>
  matchedPreferred: Array<{ keyword: string; section: string; sectionWeight: number }>
  matchedImplied: Array<{ keyword: string; section: string; impliedFrom: string }>
  missingRequired: string[]
  missingPreferred: string[]
  missingImplied: string[]
}

type TitleAlignmentDetail = DimensionResult & {
  jdTitle: string | null
  cvTitle: string | null
  matchedTokens: string[]
}

type SectionCompletenessDetail = DimensionResult & {
  expectedSections: string[]
  presentSections: string[]
  missingSections: string[]
}

type SenioritySignalDetail = DimensionResult & {
  jdRequiredYears: number | null
  cvTotalYears: number
  seniorityBasis: 'years' | 'keywords' | 'neutral'
}

type ATSScoreBreakdown = {
  finalScore: number
  label: 'poor' | 'fair' | 'good' | 'strong' | 'excellent'
  dimensions: {
    keywordCoverage: KeywordCoverageDetail
    titleAlignment: TitleAlignmentDetail
    sectionCompleteness: SectionCompletenessDetail
    senioritySignal: SenioritySignalDetail
  }
}

// What the server action returns to the client
type ATSScoreResult = {
  breakdown: ATSScoreBreakdown
  interpretation: ATSInterpretation | null   // null when LLM not configured
  impliedKeywords: string[]                  // surfaced for user transparency
}
```

---

## Chat Coach Integration

The `cv` PageContext type gains an optional `atsScore` field:

```ts
// src/modules/chat/schema.ts
type CVPageContext = {
  type: 'cv'
  title: string
  company?: string
  cvId: string
  atsScore?: string   // serialised breakdown — set when user clicks "Discuss with coach"
}
```

A `serializeATSScoreForContext(result: ATSScoreResult): string` utility (exported from `ats-score-schema.ts`, callable client-side) formats the breakdown as a compact structured summary:

```
ATS Score: 68/100 (good)

Keyword coverage (72/100): matched 12/17 required keywords.
  Missing required: Docker, Kubernetes, Terraform
  Missing preferred: GitOps, Helm, ArgoCD

Title alignment (65/100): CV shows "Senior Engineer"; JD targets "Platform Engineer"

Section completeness (85/100): missing a Tools section — expected for a DevOps-oriented role

Seniority signal (60/100): JD requires 5+ years; CV experience totals ~4.5 years

Profile opportunities (exist in profile, not surfaced in this CV):
  - Docker (skill, expert level)
  - Terraform (certification, HashiCorp)
  - Kubernetes (skill, intermediate)
```

`formatPageContext` appends this when present:

```ts
case 'cv':
  let text = `User is reviewing CV: "${ctx.title}"...\nCV ID: ${ctx.cvId} — use get_cv_document`
  if (ctx.atsScore) {
    text += `\n\n<ats_score>\n${ctx.atsScore}\n</ats_score>\n` +
      `The user has run an ATS check on this CV. Reference the breakdown when advising on CV ` +
      `improvements. Use propose_cv_update to suggest changes. Only recommend adding content ` +
      `that exists in the user's profile — do not suggest fabricating skills or experience.`
  }
  return text
```

**UX flow:**
1. User clicks "Run ATS Check" in the CV builder → results panel renders score + breakdown
2. User clicks "Discuss with coach" → serialised breakdown sets `atsScore` on page context, chat panel opens/focuses
3. Coach references `<ats_score>` in its system context and calls `propose_cv_update` for improvements

No new chat tools or API routes required.

---

## LLM Usage

| Feature tag | Purpose | Est. tokens |
|---|---|---|
| `ats-keyword-expand` | JD → implied keyword list | ~500 in / ~200 out |
| `ats-interpret` | Score breakdown + profile → narrative + opportunities | ~1500 in / ~500 out |

Both appear in the user's usage log at `/dashboard/settings/usage`. Add both to `FEATURE_LABELS` in `usage-log.tsx`.

---

## What This Does Not Replace

- **`assessJobFit`** — unchanged. Job-fit is a read on the candidate's profile vs. the JD. ATS score is a read on the generated CV document vs. the JD. Separate signals, separate UI, separate module.
- **`scanCV`** — unchanged. Internal quality monitoring, fire-and-forget, not user-facing.

---

## Future Considerations (out of scope for phase 1)

- Persist `ATSScoreBreakdown` as `atsScore Json?` on `CVDocument` (one-field migration)
- Persist implied keyword expansion as `atsKeywords Json?` on `JobApplication` (reuse across checks)
- Show ATS score in the CV document list view as a quick-glance signal
- Re-run prompt / staleness indicator when CV sections are edited after a check
