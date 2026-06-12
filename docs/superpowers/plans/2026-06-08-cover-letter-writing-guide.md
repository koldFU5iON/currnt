# Cover Letter Writing Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an optional writing guide at `/dashboard/cover-letters/[id]/guide` with three drafting modes (checklist, generate, build-with-me) and a separate review route at `/dashboard/cover-letters/[id]/review`.

**Architecture:** A standalone `src/modules/writing-guide/` module owns all AI logic (three server actions, two prompt files, one schema file). The workspace toolbar gains two new buttons; both guide and review are separate full-page routes so the side panel stays free for a future AI assistant. All three AI actions follow the five-step pipeline from `docs/ai-features.md`.

**Tech Stack:** Next.js 16 App Router, Prisma 7, AI SDK via `src/modules/llm/client.ts`, Zod, Vitest, Tailwind CSS v4 + shadcn/ui, localStorage for Build With Me persistence.

---

## File Map

**Create:**
- `src/modules/writing-guide/schema.ts` — `BuildWithMeInputs` + `ReviewOutputSchema` Zod schemas
- `src/modules/writing-guide/checklist.ts` — static checklist content, no AI
- `src/modules/writing-guide/actions.ts` — `generateDraft`, `buildWithMe`, `reviewLetter` server actions
- `src/modules/writing-guide/actions.test.ts` — unit tests for all three actions
- `src/lib/prompts/cover-letter-generate.md` — system prompt for generate + build-with-me
- `src/lib/prompts/cover-letter-review.md` — system prompt for review
- `src/app/dashboard/cover-letters/[id]/guide/page.tsx` — server component: fetches letter + job, checks LLM config
- `src/app/dashboard/cover-letters/[id]/guide/_components/guide-client.tsx` — client: mode selector state machine
- `src/app/dashboard/cover-letters/[id]/guide/_components/checklist-mode.tsx` — static checklist display
- `src/app/dashboard/cover-letters/[id]/guide/_components/generate-mode.tsx` — generate button + confirm + navigate
- `src/app/dashboard/cover-letters/[id]/guide/_components/build-with-me-mode.tsx` — form + localStorage + submit
- `src/app/dashboard/cover-letters/[id]/review/page.tsx` — server component: fetches + runs reviewLetter on load
- `src/app/dashboard/cover-letters/[id]/review/_components/review-results.tsx` — issues + strengths display

**Modify:**
- `src/app/dashboard/cover-letters/[id]/_components/cover-letter-workspace.tsx` — add ✦ Writing Guide + ✦ Review toolbar buttons
- `src/app/dashboard/settings/usage/_components/usage-log.tsx` — register three feature labels

---

## Task 1: Module schema + static checklist

**Files:**
- Create: `src/modules/writing-guide/schema.ts`
- Create: `src/modules/writing-guide/checklist.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/writing-guide/schema.test.ts
import { describe, it, expect } from 'vitest'
import { BuildWithMeInputs, ReviewOutputSchema } from './schema'

describe('BuildWithMeInputs', () => {
  it('accepts all fields empty', () => {
    const result = BuildWithMeInputs.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial answers', () => {
    const result = BuildWithMeInputs.safeParse({ whyRole: 'I love this field' })
    expect(result.success).toBe(true)
    expect(result.data?.whyRole).toBe('I love this field')
  })
})

describe('ReviewOutputSchema', () => {
  it('parses a valid review', () => {
    const input = {
      issues: [{ category: 'weak_evidence', severity: 'high', description: 'No metrics.' }],
      strengths: ['Strong opener.'],
      summary: 'Good start, needs evidence.',
    }
    const result = ReviewOutputSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects unknown category', () => {
    const input = {
      issues: [{ category: 'bad_vibes', severity: 'high', description: 'x' }],
      strengths: [],
      summary: 'x',
    }
    expect(ReviewOutputSchema.safeParse(input).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- --run src/modules/writing-guide/schema.test.ts
```

Expected: FAIL with "Cannot find module './schema'"

- [ ] **Step 3: Create `schema.ts`**

```ts
// src/modules/writing-guide/schema.ts
import { z } from 'zod'

export const BuildWithMeInputs = z.object({
  whyRole:       z.string().optional().describe('Why the candidate wants this specific role.'),
  whyCompany:    z.string().optional().describe('Why the candidate wants to work at this company.'),
  bestEvidence:  z.string().optional().describe('The experience or achievement that best proves fit.'),
  whyNow:        z.string().optional().describe('Why the candidate is making this move now.'),
  anythingElse:  z.string().optional().describe('Any other context the hiring manager should know.'),
})

export type BuildWithMeInputs = z.infer<typeof BuildWithMeInputs>

export const ReviewOutputSchema = z.object({
  issues: z.array(z.object({
    category: z.enum([
      'missing_requirement',
      'weak_evidence',
      'tone',
      'motivation',
      'unsupported_claim',
      'repetition',
    ]).describe('Type of issue found in the letter.'),
    severity: z.enum(['high', 'medium', 'low'])
      .describe('high = likely to cause rejection; medium = weakens application; low = minor improvement.'),
    description: z.string()
      .describe('Plain English explanation of the issue, 1–2 sentences. Be specific.'),
  })),
  strengths: z.array(z.string().describe('One thing the letter does well, one sentence.')),
  summary: z.string().describe('One sentence overall assessment of the letter.'),
})

export type ReviewOutput = z.infer<typeof ReviewOutputSchema>
```

- [ ] **Step 4: Create `checklist.ts`**

```ts
// src/modules/writing-guide/checklist.ts
export type ChecklistSection = {
  heading: string
  prompts: string[]
}

export const CHECKLIST: ChecklistSection[] = [
  {
    heading: 'Opening',
    prompts: [
      'Name the specific role in your first sentence — not "a position at your company".',
      'Lead with why this role caught your attention, not "I am writing to apply for…"',
      'Open with "you" energy: what you bring, not what you want.',
    ],
  },
  {
    heading: 'Company interest',
    prompts: [
      'Name one specific thing about the company — a product, mission, or recent news.',
      'Explain why that resonates with your own direction, not just "I admire your work".',
    ],
  },
  {
    heading: 'Your fit',
    prompts: [
      'Pick your single strongest piece of evidence. Make it specific: role, company, number, outcome.',
      'Connect that evidence directly to a requirement in the job description.',
      'If they list a must-have you\'re light on, address it — don\'t hope they won\'t notice.',
    ],
  },
  {
    heading: 'Closing',
    prompts: [
      'End with a confident, specific call to action — not "I look forward to hearing from you".',
      'Keep the closing short. One sentence is enough.',
    ],
  },
]
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npm test -- --run src/modules/writing-guide/schema.test.ts
```

Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add src/modules/writing-guide/schema.ts src/modules/writing-guide/schema.test.ts src/modules/writing-guide/checklist.ts
git commit -m "feat(writing-guide): module schema and static checklist"
```

---

## Task 2: Prompt files + `generateDraft` action

**Files:**
- Create: `src/lib/prompts/cover-letter-generate.md`
- Create: `src/modules/writing-guide/actions.ts` (generateDraft only)
- Create: `src/modules/writing-guide/actions.test.ts` (generateDraft tests only)

- [ ] **Step 1: Create the generate prompt**

```markdown
<!-- src/lib/prompts/cover-letter-generate.md -->
You are an expert career coach and copywriter specialising in job applications.

Write a complete cover letter in markdown format. Include the full document — header block and letter body.

## Header format

Use exactly this structure:

# [Candidate Name]
**[Candidate Headline]**
[contact details joined with " · " — email, phone, LinkedIn, website — include only those provided]

---

## Body

Open with: Dear Hiring Manager,

Write 3–4 paragraphs (250–350 words total):

- Paragraph 1: A specific opening naming the role and showing genuine interest — no "I am writing to apply for"
- Paragraph 2: The candidate's strongest evidence of fit with concrete outcomes and numbers
- Paragraph 3: Why this company specifically, using signals from the job description
- Paragraph 4 (optional): Short confident close — no "I look forward to hearing from you"

Close with:

Yours sincerely,
[Candidate Name]

## Tone rules

- Professional, direct, and human
- Never start a sentence with "I" as the first word of the letter
- Avoid: "I am passionate about", "team player", "great fit", "I believe", "I feel"
- Use specific metrics and named technologies from the candidate's background
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/modules/writing-guide/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({
  requireProfile: vi.fn().mockResolvedValue({
    profile: { id: 'profile-1', name: 'Test User' },
  }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    coverLetterDocument: { findFirst: vi.fn() },
    cVDocument: { findFirst: vi.fn() },
    jobApplication: { findFirst: vi.fn() },
  },
}))
vi.mock('@/modules/profile/snapshot', () => ({
  buildProfileSnapshot: vi.fn().mockResolvedValue({}),
  serializeProfileForLLM: vi.fn().mockReturnValue('# Test User'),
}))
vi.mock('@/modules/llm/prompt-context', () => ({
  loadWritingContext: vi.fn().mockResolvedValue({ rules: '', brief: null }),
  composeSystem: vi.fn().mockReturnValue('system prompt'),
}))
vi.mock('@/modules/llm/client', () => ({
  complete: vi.fn(),
  completeStructured: vi.fn(),
}))
vi.mock('@/modules/cv/export', () => ({
  toMarkdown: vi.fn().mockReturnValue('CV markdown'),
}))
vi.mock('@/modules/cv/schema', () => ({
  CVDocumentContentSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) },
}))

import { generateDraft } from './actions'
import { prisma } from '@/lib/db'
import { complete } from '@/modules/llm/client'

const mockLetterFind = vi.mocked(prisma.coverLetterDocument.findFirst)
const mockCVFind = vi.mocked(prisma.cVDocument.findFirst)
const mockComplete = vi.mocked(complete)

describe('generateDraft', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns not_found when letter does not belong to profile', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await generateDraft('letter-missing')
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('calls complete and returns generated content', async () => {
    mockLetterFind.mockResolvedValue({
      id: 'letter-1',
      content: '',
      jobApplicationId: null,
      jobTitle: 'Senior PM',
      company: 'Acme',
      jobApplication: null,
    } as never)
    mockCVFind.mockResolvedValue(null)
    mockComplete.mockResolvedValue({ text: '# Test User\n\nDear Hiring Manager,\n\nBody.' } as never)

    const result = await generateDraft('letter-1')
    expect(result).toEqual({ ok: true, content: '# Test User\n\nDear Hiring Manager,\n\nBody.' })
    expect(mockComplete).toHaveBeenCalledWith(
      'profile-1',
      expect.any(String),
      expect.objectContaining({ feature: 'cover-letter-generate' }),
    )
  })

  it('returns llm error kind on LLMError', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    const { LLMError } = await import('@/modules/llm/errors')
    mockComplete.mockRejectedValue(new LLMError('not_configured', 'No key'))

    const result = await generateDraft('letter-1')
    expect(result).toEqual({ ok: false, error: 'not_configured', message: 'No key' })
  })
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
npm test -- --run src/modules/writing-guide/actions.test.ts
```

Expected: FAIL with "Cannot find module './actions'"

- [ ] **Step 4: Create `actions.ts` with `generateDraft`**

```ts
// src/modules/writing-guide/actions.ts
'use server'

import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { complete, completeStructured } from '@/modules/llm/client'
import { LLMError, type LLMErrorKind } from '@/modules/llm/errors'
import { buildProfileSnapshot, serializeProfileForLLM } from '@/modules/profile/snapshot'
import { loadWritingContext, composeSystem } from '@/modules/llm/prompt-context'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { CVDocumentContentSchema } from '@/modules/cv/schema'
import { toMarkdown } from '@/modules/cv/export'
import { ReviewOutputSchema } from './schema'
import type { BuildWithMeInputs, ReviewOutput } from './schema'

type GenerateResult =
  | { ok: true; content: string }
  | { ok: false; error: 'not_found'; message: string }
  | { ok: false; error: LLMErrorKind; message: string }

type ReviewResult =
  | { ok: true; review: ReviewOutput }
  | { ok: false; error: 'not_found' | 'no_content'; message: string }
  | { ok: false; error: LLMErrorKind; message: string }

async function loadGeneratePrompt(): Promise<string> {
  return readFile(
    path.join(process.cwd(), 'src/lib/prompts/cover-letter-generate.md'),
    'utf-8',
  )
}

async function loadReviewPrompt(): Promise<string> {
  return readFile(
    path.join(process.cwd(), 'src/lib/prompts/cover-letter-review.md'),
    'utf-8',
  )
}

async function gatherInputs(profileId: string, letterId: string) {
  const letter = await prisma.coverLetterDocument.findFirst({
    where: { id: letterId, profileId },
    select: {
      id: true,
      content: true,
      jobApplicationId: true,
      jobTitle: true,
      company: true,
      jobApplication: {
        select: { title: true, company: true, jobDescription: true, jobAnalysis: true },
      },
    },
  })
  if (!letter) return null

  const [snapshot, writingCtx] = await Promise.all([
    buildProfileSnapshot(profileId),
    loadWritingContext(profileId),
  ])

  let cvMarkdown: string | null = null
  if (letter.jobApplicationId) {
    const cv = await prisma.cVDocument.findFirst({
      where: { jobApplicationId: letter.jobApplicationId, profileId },
      orderBy: { updatedAt: 'desc' },
      select: { generatedContent: true },
    })
    if (cv) {
      const parsed = CVDocumentContentSchema.safeParse(JSON.parse(cv.generatedContent))
      if (parsed.success) cvMarkdown = toMarkdown(parsed.data)
    }
  }

  return { letter, snapshot, writingCtx, cvMarkdown }
}

function buildGeneratePrompt(inputs: Awaited<ReturnType<typeof gatherInputs>> & object): string {
  const { letter, snapshot, cvMarkdown } = inputs
  const job = letter.jobApplication
  const profileMd = serializeProfileForLLM(snapshot)

  let prompt = `# Candidate Profile\n\n${profileMd}`

  if (cvMarkdown) {
    prompt += `\n\n# Tailored CV\n\n${cvMarkdown}`
  }

  const title = letter.jobTitle ?? job?.title
  const company = letter.company ?? job?.company
  if (title || company) {
    prompt += `\n\n# Role\n\n**${title ?? 'Unknown role'}**${company ? ` at ${company}` : ''}`
  }

  if (job?.jobDescription) {
    prompt += `\n\n## Job Description\n\n${job.jobDescription}`
  }

  return prompt
}

export async function generateDraft(letterId: string): Promise<GenerateResult> {
  const { profile } = await requireProfile()

  const inputs = await gatherInputs(profile.id, letterId)
  if (!inputs) return { ok: false, error: 'not_found', message: 'Cover letter not found' }

  const [systemPrompt, userPrompt] = await Promise.all([
    loadGeneratePrompt(),
    Promise.resolve(buildGeneratePrompt(inputs)),
  ])
  const system = composeSystem(inputs.writingCtx.rules, inputs.writingCtx.brief, systemPrompt)

  try {
    const result = await complete(profile.id, userPrompt, {
      system,
      feature: 'cover-letter-generate',
      temperature: 0.7,
      maxOutputTokens: 1200,
    })
    return { ok: true, content: result.text }
  } catch (err) {
    if (err instanceof LLMError) return { ok: false, error: err.kind, message: err.message }
    throw err
  }
}

export async function buildWithMe(
  letterId: string,
  answers: BuildWithMeInputs,
): Promise<GenerateResult> {
  return { ok: false, error: 'not_found', message: 'not implemented' }
}

export async function reviewLetter(letterId: string): Promise<ReviewResult> {
  return { ok: false, error: 'not_found', message: 'not implemented' }
}
```

- [ ] **Step 5: Run tests — expect PASS for generateDraft tests**

```bash
npm test -- --run src/modules/writing-guide/actions.test.ts
```

Expected: generateDraft tests pass (3 pass)

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/prompts/cover-letter-generate.md src/modules/writing-guide/actions.ts src/modules/writing-guide/actions.test.ts
git commit -m "feat(writing-guide): generateDraft action and prompt"
```

---

## Task 3: `buildWithMe` action

**Files:**
- Modify: `src/modules/writing-guide/actions.ts` (replace the stub)
- Modify: `src/modules/writing-guide/actions.test.ts` (add buildWithMe tests)

- [ ] **Step 1: Add the failing tests**

Add to `src/modules/writing-guide/actions.test.ts` after the `generateDraft` describe block:

```ts
import { buildWithMe } from './actions'

describe('buildWithMe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns not_found when letter missing', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await buildWithMe('missing', {})
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('includes answers in prompt and calls complete', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    mockComplete.mockResolvedValue({ text: 'Dear Hiring Manager,' } as never)

    const result = await buildWithMe('letter-1', { whyRole: 'Excited about the product', whyCompany: 'Love the mission' })
    expect(result).toEqual({ ok: true, content: 'Dear Hiring Manager,' })

    const promptArg = mockComplete.mock.calls[0][1] as string
    expect(promptArg).toContain('Excited about the product')
    expect(promptArg).toContain('Love the mission')
    expect(mockComplete).toHaveBeenCalledWith(
      'profile-1',
      expect.any(String),
      expect.objectContaining({ feature: 'cover-letter-build' }),
    )
  })
})
```

- [ ] **Step 2: Run — expect FAIL on the new tests**

```bash
npm test -- --run src/modules/writing-guide/actions.test.ts
```

Expected: new buildWithMe tests FAIL

- [ ] **Step 3: Implement `buildWithMe` in `actions.ts`**

Replace the `buildWithMe` stub with:

```ts
export async function buildWithMe(
  letterId: string,
  answers: BuildWithMeInputs,
): Promise<GenerateResult> {
  const { profile } = await requireProfile()

  const inputs = await gatherInputs(profile.id, letterId)
  if (!inputs) return { ok: false, error: 'not_found', message: 'Cover letter not found' }

  let userPrompt = buildGeneratePrompt(inputs)

  const answerLines: string[] = []
  if (answers.whyRole)      answerLines.push(`**Why this role:** ${answers.whyRole}`)
  if (answers.whyCompany)   answerLines.push(`**Why this company:** ${answers.whyCompany}`)
  if (answers.bestEvidence) answerLines.push(`**Best evidence of fit:** ${answers.bestEvidence}`)
  if (answers.whyNow)       answerLines.push(`**Why making this move now:** ${answers.whyNow}`)
  if (answers.anythingElse) answerLines.push(`**Additional context:** ${answers.anythingElse}`)

  if (answerLines.length > 0) {
    userPrompt += `\n\n# Your Context\n\n${answerLines.join('\n\n')}`
  }

  const systemPrompt = await loadGeneratePrompt()
  const system = composeSystem(inputs.writingCtx.rules, inputs.writingCtx.brief, systemPrompt)

  try {
    const result = await complete(profile.id, userPrompt, {
      system,
      feature: 'cover-letter-build',
      temperature: 0.7,
      maxOutputTokens: 1200,
    })
    return { ok: true, content: result.text }
  } catch (err) {
    if (err instanceof LLMError) return { ok: false, error: err.kind, message: err.message }
    throw err
  }
}
```

- [ ] **Step 4: Run tests — all pass**

```bash
npm test -- --run src/modules/writing-guide/actions.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/writing-guide/actions.ts src/modules/writing-guide/actions.test.ts
git commit -m "feat(writing-guide): buildWithMe action"
```

---

## Task 4: `reviewLetter` action + review prompt

**Files:**
- Create: `src/lib/prompts/cover-letter-review.md`
- Modify: `src/modules/writing-guide/actions.ts` (replace stub)
- Modify: `src/modules/writing-guide/actions.test.ts` (add reviewLetter tests)

- [ ] **Step 1: Create the review prompt**

```markdown
<!-- src/lib/prompts/cover-letter-review.md -->
You are an experienced recruitment professional reviewing a cover letter.

Assess the cover letter against the candidate's profile and the job requirements. Be honest and specific — vague feedback does not help the candidate improve.

Return a JSON object with exactly these fields:

- issues: array of problems found. For each:
  - category: one of missing_requirement | weak_evidence | tone | motivation | unsupported_claim | repetition
  - severity: high (likely to cause rejection) | medium (weakens the application) | low (minor)
  - description: 1–2 sentences explaining the specific problem and where it appears in the letter

- strengths: array of 1–3 specific things the letter does well. Each is one sentence. If nothing stands out, return an empty array.

- summary: one sentence overall assessment.

Rules:
- Do not invent problems. If the letter is solid, return an empty issues array.
- Be specific: "The opening paragraph does not mention the role" beats "The opening is weak".
- Cross-reference the job description's must-haves against what the letter addresses.
```

- [ ] **Step 2: Add failing tests**

Add to `src/modules/writing-guide/actions.test.ts`:

```ts
import { reviewLetter } from './actions'
import { completeStructured } from '@/modules/llm/client'

const mockCompleteStructured = vi.mocked(completeStructured)

describe('reviewLetter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns not_found when letter missing', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await reviewLetter('missing')
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('returns no_content when letter is empty', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    const result = await reviewLetter('letter-1')
    expect(result).toEqual({ ok: false, error: 'no_content', message: expect.any(String) })
  })

  it('calls completeStructured and returns review', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: 'Dear Hiring Manager,\n\nBody text.', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    const review = { issues: [], strengths: ['Clear opening.'], summary: 'Good letter.' }
    mockCompleteStructured.mockResolvedValue({ object: review } as never)

    const result = await reviewLetter('letter-1')
    expect(result).toEqual({ ok: true, review })
    expect(mockCompleteStructured).toHaveBeenCalledWith(
      'profile-1',
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ feature: 'cover-letter-review' }),
    )
  })
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
npm test -- --run src/modules/writing-guide/actions.test.ts
```

Expected: reviewLetter tests FAIL

- [ ] **Step 4: Implement `reviewLetter` in `actions.ts`**

Replace the `reviewLetter` stub:

```ts
export async function reviewLetter(letterId: string): Promise<ReviewResult> {
  const { profile } = await requireProfile()

  const inputs = await gatherInputs(profile.id, letterId)
  if (!inputs) return { ok: false, error: 'not_found', message: 'Cover letter not found' }

  if (!inputs.letter.content.trim()) {
    return { ok: false, error: 'no_content', message: 'Write something first before requesting a review.' }
  }

  let userPrompt = `# Cover Letter to Review\n\n${inputs.letter.content}`
  userPrompt += `\n\n# Candidate Profile\n\n${serializeProfileForLLM(inputs.snapshot)}`

  const job = inputs.letter.jobApplication
  const title = inputs.letter.jobTitle ?? job?.title
  const company = inputs.letter.company ?? job?.company
  if (title || company) {
    userPrompt += `\n\n# Role\n\n**${title ?? 'Unknown role'}**${company ? ` at ${company}` : ''}`
  }
  if (job?.jobDescription) {
    userPrompt += `\n\n## Job Description\n\n${job.jobDescription}`
  }

  const systemPrompt = await loadReviewPrompt()
  const system = composeSystem(inputs.writingCtx.rules, inputs.writingCtx.brief, systemPrompt)

  try {
    const result = await completeStructured(profile.id, userPrompt, ReviewOutputSchema, {
      system,
      feature: 'cover-letter-review',
      temperature: 0,
      maxOutputTokens: 800,
    })
    return { ok: true, review: result.object }
  } catch (err) {
    if (err instanceof LLMError) return { ok: false, error: err.kind, message: err.message }
    throw err
  }
}
```

- [ ] **Step 5: Run all tests — all pass**

```bash
npm test -- --run src/modules/writing-guide/actions.test.ts
```

Expected: all 8 tests pass

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/prompts/cover-letter-review.md src/modules/writing-guide/actions.ts src/modules/writing-guide/actions.test.ts
git commit -m "feat(writing-guide): reviewLetter action and prompt"
```

---

## Task 5: Guide landing page + mode selector

**Files:**
- Create: `src/app/dashboard/cover-letters/[id]/guide/page.tsx`
- Create: `src/app/dashboard/cover-letters/[id]/guide/_components/guide-client.tsx`

- [ ] **Step 1: Create `guide/page.tsx`**

```tsx
// src/app/dashboard/cover-letters/[id]/guide/page.tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/session'
import { getCoverLetter } from '@/modules/cover-letters/queries'
import { getLLMConfigStatus } from '@/modules/llm/client'
import { GuideClient } from './_components/guide-client'

type Props = { params: Promise<{ id: string }> }

export default async function GuidePage({ params }: Props) {
  const [{ id }, { profile }] = await Promise.all([params, requireProfile()])
  const [letter, llmStatus] = await Promise.all([
    getCoverLetter(profile.id, id),
    getLLMConfigStatus(profile.id),
  ])
  if (!letter) notFound()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2 text-sm">
        <Link href={`/dashboard/cover-letters/${id}`} className="text-muted-foreground hover:text-foreground">
          ← Back to letter
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold">✦ Writing Guide</span>
        {(letter.jobTitle || letter.company) && (
          <span className="text-xs text-muted-foreground">
            {[letter.jobTitle, letter.company].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <GuideClient letter={letter} llmConfigured={llmStatus.configured} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `guide-client.tsx`**

```tsx
// src/app/dashboard/cover-letters/[id]/guide/_components/guide-client.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { CoverLetterWithJob } from '@/modules/cover-letters/queries'
import { ChecklistMode } from './checklist-mode'
import { GenerateMode } from './generate-mode'
import { BuildWithMeMode } from './build-with-me-mode'

type Mode = null | 'checklist' | 'generate' | 'build'

type Props = {
  letter: CoverLetterWithJob
  llmConfigured: boolean
}

export function GuideClient({ letter, llmConfigured }: Props) {
  const [mode, setMode] = useState<Mode>(null)
  const router = useRouter()

  function handleAICardClick(target: 'generate' | 'build') {
    if (!llmConfigured) {
      toast.error('AI not configured', {
        action: { label: 'Set up →', onClick: () => router.push('/dashboard/settings/llm') },
      })
      return
    }
    setMode(target)
  }

  if (mode === 'checklist') return <ChecklistMode onBack={() => setMode(null)} />
  if (mode === 'generate') return <GenerateMode letter={letter} onBack={() => setMode(null)} />
  if (mode === 'build') return <BuildWithMeMode letter={letter} onBack={() => setMode(null)} />

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-lg font-semibold">How would you like to start?</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Three ways to get your first draft.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {/* Checklist — always available */}
        <button
          onClick={() => setMode('checklist')}
          className="rounded-lg border border-border bg-card p-4 text-left hover:bg-accent/50 transition-colors"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">No AI needed</p>
          <p className="mt-1 font-semibold">Writing checklist</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Structured tips and prompts to guide your writing.</p>
        </button>

        {/* Generate — AI required */}
        <button
          onClick={() => handleAICardClick('generate')}
          className="rounded-lg border border-border bg-card p-4 text-left hover:bg-accent/50 transition-colors"
          style={!llmConfigured ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">✦ AI</p>
          <p className="mt-1 font-semibold">Generate a draft</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            AI writes from your profile, CV, and job description.
          </p>
        </button>

        {/* Build with me — AI required */}
        <button
          onClick={() => handleAICardClick('build')}
          className="rounded-lg border border-border bg-card p-4 text-left hover:bg-accent/50 transition-colors"
          style={!llmConfigured ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">✦ AI</p>
          <p className="mt-1 font-semibold">Build with me</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Answer a few questions. AI uses your answers to write the letter.
          </p>
        </button>
      </div>

      {!llmConfigured && (
        <div className="mt-4 flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <span>✦ AI features require an API key.</span>
          <a href="/dashboard/settings/llm" className="font-semibold text-primary hover:underline">
            Set up →
          </a>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/cover-letters/[id]/guide/
git commit -m "feat(writing-guide): guide landing page and mode selector"
```

---

## Task 6: Checklist mode component

**Files:**
- Create: `src/app/dashboard/cover-letters/[id]/guide/_components/checklist-mode.tsx`

- [ ] **Step 1: Create `checklist-mode.tsx`**

```tsx
// src/app/dashboard/cover-letters/[id]/guide/_components/checklist-mode.tsx
import { CHECKLIST } from '@/modules/writing-guide/checklist'
import { Button } from '@/components/ui/button'

type Props = { onBack: () => void }

export function ChecklistMode({ onBack }: Props) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <button
        onClick={onBack}
        className="mb-6 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>

      <h2 className="text-lg font-semibold">Writing checklist</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Work through each section before you start or as you write.
      </p>

      <div className="mt-6 space-y-6">
        {CHECKLIST.map((section) => (
          <div key={section.heading}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {section.heading}
            </h3>
            <ul className="mt-2 space-y-2">
              {section.prompts.map((prompt) => (
                <li key={prompt} className="flex gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
                  <span>{prompt}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/cover-letters/[id]/guide/_components/checklist-mode.tsx
git commit -m "feat(writing-guide): checklist mode component"
```

---

## Task 7: Generate mode component

**Files:**
- Create: `src/app/dashboard/cover-letters/[id]/guide/_components/generate-mode.tsx`

- [ ] **Step 1: Create `generate-mode.tsx`**

```tsx
// src/app/dashboard/cover-letters/[id]/guide/_components/generate-mode.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { generateDraft } from '@/modules/writing-guide/actions'
import { updateCoverLetterContent } from '@/modules/cover-letters/actions'
import type { CoverLetterWithJob } from '@/modules/cover-letters/queries'

type Props = {
  letter: CoverLetterWithJob
  onBack: () => void
}

export function GenerateMode({ letter, onBack }: Props) {
  const [isPending, setIsPending] = useState(false)
  const [pendingContent, setPendingContent] = useState<string | null>(null)
  const router = useRouter()

  async function handleGenerate() {
    setIsPending(true)
    const result = await generateDraft(letter.id)
    setIsPending(false)

    if (!result.ok) {
      toast.error(result.message, {
        action: result.error === 'not_configured'
          ? { label: 'Set up →', onClick: () => router.push('/dashboard/settings/llm') }
          : undefined,
      })
      return
    }

    if (letter.content.trim() !== '') {
      setPendingContent(result.content)
    } else {
      await applyContent(result.content)
    }
  }

  async function applyContent(content: string) {
    await updateCoverLetterContent(letter.id, content)
    router.push(`/dashboard/cover-letters/${letter.id}`)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <button onClick={onBack} className="mb-6 text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </button>

      <h2 className="text-lg font-semibold">Generate a draft</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        AI writes a full first draft using your profile, CV, and the job description. Takes about 10–20 seconds.
      </p>

      {letter.jobApplication?.jobDescription ? null : (
        <div className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          No job description found. The draft will be based on your profile alone — adding a job description gives better results.
        </div>
      )}

      <Button
        className="mt-6"
        disabled={isPending}
        onClick={handleGenerate}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 size-4" />
            Generate draft
          </>
        )}
      </Button>

      <Dialog open={pendingContent !== null} onOpenChange={() => setPendingContent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace existing draft?</DialogTitle>
            <DialogDescription>
              This will replace your current cover letter content. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingContent(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingContent) applyContent(pendingContent)
                setPendingContent(null)
              }}
            >
              Replace draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/cover-letters/[id]/guide/_components/generate-mode.tsx
git commit -m "feat(writing-guide): generate draft mode component"
```

---

## Task 8: Build With Me mode component

**Files:**
- Create: `src/app/dashboard/cover-letters/[id]/guide/_components/build-with-me-mode.tsx`

- [ ] **Step 1: Create `build-with-me-mode.tsx`**

```tsx
// src/app/dashboard/cover-letters/[id]/guide/_components/build-with-me-mode.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildWithMe } from '@/modules/writing-guide/actions'
import { updateCoverLetterContent } from '@/modules/cover-letters/actions'
import type { CoverLetterWithJob } from '@/modules/cover-letters/queries'
import type { BuildWithMeInputs } from '@/modules/writing-guide/schema'

type Props = {
  letter: CoverLetterWithJob
  onBack: () => void
}

const STORAGE_KEY = (id: string) => `writing-guide-${id}`

const QUESTIONS: { field: keyof BuildWithMeInputs; label: string; placeholder: string }[] = [
  { field: 'whyRole',       label: 'Why are you interested in this role?',                        placeholder: 'What specifically about this role attracted you…' },
  { field: 'whyCompany',    label: 'Why are you interested in this company?',                     placeholder: 'What about the company, its mission, or its work…' },
  { field: 'bestEvidence',  label: 'Which experience or achievement best proves your fit?',       placeholder: 'A specific project, metric, or outcome…' },
  { field: 'whyNow',        label: 'Why are you making this move now?',                           placeholder: 'What\'s driving your decision to look for a new role…' },
  { field: 'anythingElse',  label: 'Is there anything else the hiring manager should know?',      placeholder: 'Any context that isn\'t obvious from your CV…' },
]

export function BuildWithMeMode({ letter, onBack }: Props) {
  const [answers, setAnswers] = useState<BuildWithMeInputs>({})
  const [isPending, setIsPending] = useState(false)
  const [pendingContent, setPendingContent] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const storageKey = STORAGE_KEY(letter.id)

  // Load saved answers from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setAnswers(JSON.parse(saved))
    } catch {}
  }, [storageKey])

  function handleChange(field: keyof BuildWithMeInputs, value: string) {
    const updated = { ...answers, [field]: value }
    setAnswers(updated)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(updated)) } catch {}
    }, 500)
  }

  const hasAnyAnswer = Object.values(answers).some(v => v?.trim())

  async function handleSubmit() {
    setIsPending(true)
    const result = await buildWithMe(letter.id, answers)
    setIsPending(false)

    if (!result.ok) {
      toast.error(result.message, {
        action: result.error === 'not_configured'
          ? { label: 'Set up →', onClick: () => router.push('/dashboard/settings/llm') }
          : undefined,
      })
      return
    }

    if (letter.content.trim() !== '') {
      setPendingContent(result.content)
    } else {
      await applyContent(result.content)
    }
  }

  async function applyContent(content: string) {
    await updateCoverLetterContent(letter.id, content)
    try { localStorage.removeItem(storageKey) } catch {}
    router.push(`/dashboard/cover-letters/${letter.id}`)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <button onClick={onBack} className="mb-6 text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </button>

      <h2 className="text-lg font-semibold">Build with me</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Answer as many questions as you like — all are optional. Your answers are saved automatically.
      </p>

      <div className="mt-6 space-y-5">
        {QUESTIONS.map(({ field, label, placeholder }) => (
          <div key={field}>
            <label className="block text-sm font-medium">{label}</label>
            <textarea
              value={answers[field] ?? ''}
              onChange={e => handleChange(field, e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/50"
            />
          </div>
        ))}
      </div>

      <Button
        className="mt-6"
        disabled={isPending || !hasAnyAnswer}
        onClick={handleSubmit}
        title={!hasAnyAnswer ? 'Answer at least one question to continue' : undefined}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 size-4" />
            Build my draft
          </>
        )}
      </Button>

      <Dialog open={pendingContent !== null} onOpenChange={() => setPendingContent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace existing draft?</DialogTitle>
            <DialogDescription>
              This will replace your current cover letter content. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingContent(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingContent) applyContent(pendingContent)
                setPendingContent(null)
              }}
            >
              Replace draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/cover-letters/[id]/guide/_components/build-with-me-mode.tsx
git commit -m "feat(writing-guide): build with me mode component"
```

---

## Task 9: Review page + results component

**Files:**
- Create: `src/app/dashboard/cover-letters/[id]/review/page.tsx`
- Create: `src/app/dashboard/cover-letters/[id]/review/_components/review-results.tsx`

- [ ] **Step 1: Create `review/page.tsx`**

```tsx
// src/app/dashboard/cover-letters/[id]/review/page.tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/session'
import { getCoverLetter } from '@/modules/cover-letters/queries'
import { reviewLetter } from '@/modules/writing-guide/actions'
import { ReviewResults } from './_components/review-results'

type Props = { params: Promise<{ id: string }> }

export default async function ReviewPage({ params }: Props) {
  const [{ id }, { profile }] = await Promise.all([params, requireProfile()])
  const letter = await getCoverLetter(profile.id, id)
  if (!letter) notFound()

  if (!letter.content.trim()) {
    redirect(`/dashboard/cover-letters/${id}`)
  }

  const result = await reviewLetter(id)

  const title = letter.jobTitle ?? letter.jobApplication?.title
  const company = letter.company ?? letter.jobApplication?.company

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2 text-sm">
        <Link href={`/dashboard/cover-letters/${id}`} className="text-muted-foreground hover:text-foreground">
          ← Back to letter
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold">✦ Review</span>
        {(title || company) && (
          <span className="text-xs text-muted-foreground">
            {[title, company].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {result.ok ? (
          <ReviewResults review={result.review} />
        ) : (
          <div className="mx-auto max-w-lg px-4 py-10">
            <p className="text-sm text-destructive">{result.message}</p>
            <Link href={`/dashboard/cover-letters/${id}`} className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">
              ← Back to letter
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `review-results.tsx`**

```tsx
// src/app/dashboard/cover-letters/[id]/review/_components/review-results.tsx
import { cn } from '@/lib/utils'
import type { ReviewOutput } from '@/modules/writing-guide/schema'

const CATEGORY_LABELS: Record<string, string> = {
  missing_requirement: 'Missing requirement',
  weak_evidence:       'Weak evidence',
  tone:                'Tone',
  motivation:          'Motivation',
  unsupported_claim:   'Unsupported claim',
  repetition:          'Repetition',
}

const SEVERITY_STYLES: Record<string, string> = {
  high:   'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  low:    'bg-muted text-muted-foreground border-border',
}

type Props = { review: ReviewOutput }

export function ReviewResults({ review }: Props) {
  const high   = review.issues.filter(i => i.severity === 'high')
  const medium = review.issues.filter(i => i.severity === 'medium')
  const low    = review.issues.filter(i => i.severity === 'low')

  return (
    <div className="mx-auto max-w-lg px-4 py-10 space-y-8">
      {/* Summary */}
      <p className="text-sm italic text-muted-foreground">{review.summary}</p>

      {review.issues.length === 0 && (
        <p className="text-sm font-medium">No significant issues found. Your letter looks solid.</p>
      )}

      {/* Issues by severity */}
      {[
        { label: 'High priority', items: high },
        { label: 'Medium priority', items: medium },
        { label: 'Low priority', items: low },
      ].map(({ label, items }) =>
        items.length > 0 ? (
          <div key={label}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              {label}
            </h3>
            <div className="space-y-2">
              {items.map((issue, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-md border px-3 py-2.5 text-sm',
                    SEVERITY_STYLES[issue.severity],
                  )}
                >
                  <span className="font-semibold">{CATEGORY_LABELS[issue.category]}: </span>
                  {issue.description}
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}

      {/* Strengths */}
      {review.strengths.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            Strengths
          </h3>
          <ul className="space-y-1">
            {review.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/cover-letters/[id]/review/
git commit -m "feat(writing-guide): review page and results component"
```

---

## Task 10: Workspace toolbar buttons + feature labels

**Files:**
- Modify: `src/app/dashboard/cover-letters/[id]/_components/cover-letter-workspace.tsx`
- Modify: `src/app/dashboard/settings/usage/_components/usage-log.tsx`

- [ ] **Step 1: Add toolbar buttons to `cover-letter-workspace.tsx`**

Add `Link` import at top:

```tsx
import Link from 'next/link'
```

In the toolbar's right section, add the two new buttons before the existing Export button. Find this block:

```tsx
        {/* Right */}
        <div className="flex shrink-0 items-center gap-2">
```

Add inside that div, before the existing content:

```tsx
          <Link
            href={`/dashboard/cover-letters/${letter.id}/guide`}
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ✦ Writing Guide
          </Link>
          <Link
            href={content.trim() ? `/dashboard/cover-letters/${letter.id}/review` : '#'}
            aria-disabled={!content.trim()}
            title={!content.trim() ? 'Write something first' : undefined}
            className={cn(
              'flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs',
              content.trim()
                ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                : 'pointer-events-none opacity-40'
            )}
          >
            ✦ Review
          </Link>
```

- [ ] **Step 2: Register feature labels in `usage-log.tsx`**

In `src/app/dashboard/settings/usage/_components/usage-log.tsx`, add to the `FEATURE_LABELS` object:

```ts
  'cover-letter-generate': 'Cover letter — generate draft',
  'cover-letter-build':    'Cover letter — build with me',
  'cover-letter-review':   'Cover letter — review',
```

- [ ] **Step 3: Run all tests**

```bash
npm test -- --run src/modules/writing-guide
```

Expected: all tests pass

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/cover-letters/[id]/_components/cover-letter-workspace.tsx src/app/dashboard/settings/usage/_components/usage-log.tsx
git commit -m "feat(writing-guide): toolbar buttons and feature label registration"
```

---

## Self-review checklist

**Spec coverage:**
- ✅ `/[id]/guide` separate route — Task 5
- ✅ `/[id]/review` separate route — Task 9
- ✅ Mode selector with 3 modes — Task 5
- ✅ Writing checklist (no AI) — Tasks 1 + 6
- ✅ Generate draft (AI) — Tasks 2 + 7
- ✅ Build With Me (AI, single form, localStorage) — Tasks 3 + 8
- ✅ reviewLetter action — Task 4
- ✅ Review page (server-side on load) — Task 9
- ✅ Overwrite confirmation dialog — Tasks 7 + 8
- ✅ No confirmation when letter is empty — Tasks 7 + 8
- ✅ ✦ Writing Guide toolbar button — Task 10
- ✅ ✦ Review toolbar button (disabled when empty) — Task 10
- ✅ AI not configured: toast + "Set up →" link — Tasks 5 + 7 + 8
- ✅ Feature labels registered — Task 10
- ✅ localStorage flush on submit — Task 8
- ✅ CV content included in prompt if exists — Task 2 (`gatherInputs`)
- ✅ `loadWritingContext` used in all three actions — Tasks 2 + 3 + 4
