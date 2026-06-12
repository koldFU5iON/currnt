# Cover Letter Multi-Stage Generation Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-pass `generateDraft` server action with a 5-stage sequential pipeline that separates role analysis, message architecture, drafting, structured review, and final editing into distinct LLM calls — each surfaced to the user as a live progress label.

**Architecture:** Five exported server actions (`analyseRole`, `buildLetterArchitecture`, `draftFromArchitecture`, `reviewDraftPass`, `finaliseFromReview`) are called sequentially from the client-side `GenerateMode` component. Intermediate outputs (brief, architecture, draft, issues) are plain serialisable objects passed from client into the next stage action — no DB storage of intermediates needed. `buildWithMe` and `reviewLetter` are untouched.

**Tech Stack:** Next.js 16 Server Actions, Zod (`completeStructured` for JSON stages, `complete` for prose stages), TypeScript strict, Vitest.

---

## File map

**New files:**
- `src/lib/prompts/cl-stage1-analyse.md` — Stage 1 system prompt: role + candidate analysis → JSON brief
- `src/lib/prompts/cl-stage2-architecture.md` — Stage 2 system prompt: message architecture → JSON structure
- `src/lib/prompts/cl-stage3-draft.md` — Stage 3 system prompt: prose generation from architecture
- `src/lib/prompts/cl-stage4-review.md` — Stage 4 system prompt: structured review against Stage 1 checklist
- `src/lib/prompts/cl-stage5-final.md` — Stage 5 system prompt: apply must-fix edits only

**Modified files:**
- `src/modules/writing-guide/schema.ts` — add `Stage1BriefSchema`, `Stage2ArchitectureSchema`, `Stage4IssuesSchema` + inferred types
- `src/modules/writing-guide/actions.ts` — add 5 stage actions + `loadPrompt` helper; remove `generateDraft` + `loadGeneratePrompt`
- `src/modules/writing-guide/actions.test.ts` — replace `generateDraft` tests with stage action tests
- `src/app/dashboard/cover-letters/[id]/guide/_components/generate-mode.tsx` — sequential 5-stage calls with live progress label
- `src/app/dashboard/settings/usage/_components/usage-log.tsx` — swap `cover-letter-generate` for 5 stage feature labels

Note: `next.config.ts` already uses `./src/lib/prompts/*.md` glob — no change needed.

---

### Task 1: Schema — Stage1Brief, Stage2Architecture, Stage4Issues

**Files:**
- Modify: `src/modules/writing-guide/schema.ts`

- [ ] **Step 1: Add the three Zod schemas at the end of `src/modules/writing-guide/schema.ts`**

Append after the existing `ReviewOutputSchema` and `ReviewOutput` type:

```ts
export const Stage1BriefSchema = z.object({
  rolePurpose: z.string().describe('The specific problem the business is trying to solve — one sentence.'),
  topRequirements: z.array(z.string()).min(1).max(3).describe('Top 3 must-demonstrate requirements from the JD.'),
  track: z.enum(['comms', 'pm', 'marketing', 'bd', 'hybrid']).describe('Primary role track.'),
  selectedProofPoint: z.string().describe('The specific achievement to use as the proof paragraph, with rationale.'),
  gaps: z.array(z.string()).describe('Named gaps in the candidate profile for this role. Empty if none.'),
  screenerCriteria: z.array(z.string()).describe('Named tools, certs, or methodologies explicitly listed in the JD. Empty if none.'),
  closeFormula: z.string().describe('How to close: location, work rights, relocation note if needed.'),
})
export type Stage1Brief = z.infer<typeof Stage1BriefSchema>

export const Stage2ArchitectureSchema = z.object({
  hook: z.string().describe('Opening hook sentence — about the role problem, not the candidate.'),
  connection: z.string().describe('2–3 sentences naming the candidate as the specific answer to that problem.'),
  proofSetup: z.string().describe('Which example, which angle, which metric leads the proof paragraph.'),
  gapAcknowledgement: z.string().nullable().describe('One sentence bridging a structural gap. Null if no material gap.'),
  closeFormula: z.string().describe('Confirmed close text.'),
})
export type Stage2Architecture = z.infer<typeof Stage2ArchitectureSchema>

export const Stage4IssuesSchema = z.object({
  mustFix: z.array(z.object({
    description: z.string().describe('The specific problem.'),
    suggestedFix: z.string().describe('What to change.'),
  })).describe('Issues that would cause a hiring manager to pause.'),
  consider: z.array(z.object({
    description: z.string().describe('Improvement worth making but not blocking.'),
  })).describe('Non-blocking improvements.'),
  wordCount: z.number().describe('Body word count excluding header, salutation, and sign-off.'),
  passesChecklist: z.boolean().describe('True only if all top requirements from Stage 1 are addressed.'),
})
export type Stage4Issues = z.infer<typeof Stage4IssuesSchema>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/modules/writing-guide/schema.ts
git commit -m "feat(writing-guide): add Stage1Brief, Stage2Architecture, Stage4Issues schemas"
```

---

### Task 2: Five stage prompt files

**Files:**
- Create: `src/lib/prompts/cl-stage1-analyse.md`
- Create: `src/lib/prompts/cl-stage2-architecture.md`
- Create: `src/lib/prompts/cl-stage3-draft.md`
- Create: `src/lib/prompts/cl-stage4-review.md`
- Create: `src/lib/prompts/cl-stage5-final.md`

- [ ] **Step 1: Create `src/lib/prompts/cl-stage1-analyse.md`**

```markdown
You are a career strategist preparing a cover letter brief. Your output gates all subsequent writing — be precise and honest.

Given a job description and candidate profile, produce a structured brief. If no job description is provided, do your best from the profile and role title alone.

## Tasks

1. **Role purpose**: The specific problem the business is trying to solve — not the job title, but the actual gap this hire fills. One sentence.

2. **Top 3 requirements**: The must-demonstrate requirements from the JD — distinct from nice-to-haves. Return exactly 3, or fewer only if the JD has fewer than 3 explicit requirements.

3. **Track mapping**: Is this primarily Comms / PM / Marketing / BD? Note hybrid roles and which is primary.

4. **Proof point selection**: Identify the single best evidence of fit from the candidate's profile. Match the role's primary emphasis — not the most impressive story, the most relevant one. Name the specific achievement or project and explain in one sentence why it is the right choice.

5. **Gaps**: What is genuinely missing from the candidate's background for this role. Name gaps precisely ("no direct product team cadence experience" not "limited operations background"). Return an empty array if there are no material gaps.

6. **Screener criteria**: Named tools, certifications, or methodologies the JD lists explicitly — these are likely hard-screening criteria. Return an empty array if none are named.

7. **Close formula**: Confirm location eligibility, work rights, and whether a relocation note is needed.

## Output format

Return a JSON object with exactly these fields:
- rolePurpose: string
- topRequirements: string[] (1–3 items)
- track: "comms" | "pm" | "marketing" | "bd" | "hybrid"
- selectedProofPoint: string
- gaps: string[]
- screenerCriteria: string[]
- closeFormula: string
```

- [ ] **Step 2: Create `src/lib/prompts/cl-stage2-architecture.md`**

```markdown
You are a message architect. You have received a strategic brief about a candidate and role. Design the message structure — do not write polished prose yet.

## Tasks

1. **Hook sentence**: Name the specific problem the role exists to solve — not "I am excited to apply", not a summary of the candidate's background. The hook is about *them*, not the candidate. One sentence.

2. **Connection claim**: 2–3 sentences naming the candidate's specific intersection as the answer to that problem. This is the "why this person and not someone else" argument. Be concrete — name the specific background, not a category.

3. **Proof setup**: Name the specific example from the brief's selectedProofPoint, the angle to take, and the metric that will lead. The proof paragraph does one thing: demonstrate the connection claim with a real, specific outcome.

4. **Gap acknowledgement decision**: Check the brief's gaps field. If there is a structural gap a hiring manager will notice, describe in one sentence how to acknowledge and bridge it. If the gaps array is empty or the gaps are not hiring-manager-level concerns, return null.

5. **Close formula**: Confirm the close from the brief's closeFormula. Refine the wording if needed.

## Output format

Return a JSON object with exactly these fields:
- hook: string
- connection: string
- proofSetup: string
- gapAcknowledgement: string | null
- closeFormula: string
```

- [ ] **Step 3: Create `src/lib/prompts/cl-stage3-draft.md`**

```markdown
You are an expert cover letter writer executing a deliberate message architecture. Do not improvise structure — write exactly to the architecture provided.

## Letter structure

Write to this order:
1. Hook (from architecture.hook — use as the opening sentence, polished)
2. Connection (from architecture.connection — 2–3 sentences)
3. Proof paragraph (from architecture.proofSetup — one specific outcome with a concrete metric)
4. Gap acknowledgement (only if architecture.gapAcknowledgement is not null — one sentence)
5. Close (from architecture.closeFormula)

## Full document format

Produce the complete letter:

# [Candidate Name]
**[Candidate Headline]**
[contact details joined with " · " — email, phone, LinkedIn, website — include only those provided]

---

Dear Hiring Manager,

[Letter body — 270–320 words]

Yours sincerely,
[Candidate Name]

## Voice rules (non-negotiable)

- Contractions throughout: don't, I've, it's, we're — not occasionally, throughout
- Sentence length variation: alternate short (8–12 words) with longer (20–28 words). Never three long sentences in a row.
- No em dashes. None. If you write one, delete it before returning output.
- No passive voice: "was delivered", "were implemented", "were achieved" — rewrite as active
- No corporate jargon: synergies, leverage, facilitate, empower, bandwidth, spearhead, drive
- The first word of the letter body (after "Dear Hiring Manager,") must not be "I"
- The proof paragraph must include at least one specific metric — "significant improvement" is not a metric

## What not to do

- Do not deviate from the architecture
- Do not add paragraphs not in the architecture
- Do not write "I am writing to apply for"
- Do not write "I am passionate about"
- Do not write "I believe" or "I feel"
```

- [ ] **Step 4: Create `src/lib/prompts/cl-stage4-review.md`**

```markdown
You are a recruitment professional conducting a fresh review of a cover letter. You have not seen the drafting process — read this letter as a recruiter would.

You have been given the letter draft, the original strategic brief (top 3 requirements and screener criteria), and the candidate profile for cross-referencing.

## Review tasks

1. **Top-3 requirements check**: For each requirement in topRequirements, is it addressed in the letter — even obliquely? If not, it is a must-fix with a suggested fix.

2. **Screener criteria check**: For each item in screenerCriteria, is it present in the letter OR in the candidate profile? Flag absences from BOTH only — if the profile covers it, do not flag it as missing from the letter.

3. **Seniority read**: Does any claim risk reading as execution-level rather than ownership-level? Flag if the candidate sounds like they personally built a thing rather than owned an outcome.

4. **Voice violations**: Find em dashes (—), passive constructions ("was [verb]", "were [verb]"), and parallel bullet structures. Flag each as a consider item unless they significantly weaken the letter.

5. **Word count**: Count the body words from the opening sentence to the sign-off line, excluding the header block and "Yours sincerely, [Name]". Flag if outside 270–320.

## Output format

Return a JSON object with exactly these fields:
- mustFix: array of { description: string, suggestedFix: string }
- consider: array of { description: string }
- wordCount: number
- passesChecklist: boolean (true only if all topRequirements are addressed)
```

- [ ] **Step 5: Create `src/lib/prompts/cl-stage5-final.md`**

```markdown
You are a precise copy editor. You have a cover letter draft and a flagged issues list. Apply the must-fix items only. Do not change what is not flagged.

## Instructions

1. Apply every item in mustFix
2. From the consider list, apply only voice violations: em dashes and passive constructions
3. Do not change structure, do not add content, do not remove paragraphs

After edits, run these checks in order:
- Grep for em dashes (—). If any remain, remove them.
- Grep for "was [past participle]" and "were [past participle]" patterns. Rewrite as active voice.
- Confirm the close formula is complete and present.

## Output

Return the complete final letter — header block, salutation, body, sign-off. No commentary. No explanation of changes. Letter only.
```

- [ ] **Step 6: Commit prompt files**

```bash
git add src/lib/prompts/cl-stage1-analyse.md src/lib/prompts/cl-stage2-architecture.md src/lib/prompts/cl-stage3-draft.md src/lib/prompts/cl-stage4-review.md src/lib/prompts/cl-stage5-final.md
git commit -m "feat(writing-guide): add 5 stage prompt files for multi-pass pipeline"
```

---

### Task 3: Stage 1 + 2 server actions

**Files:**
- Modify: `src/modules/writing-guide/actions.ts`
- Modify: `src/modules/writing-guide/actions.test.ts`

Context: `actions.ts` starts with `'use server'`. It currently exports `generateDraft`, `buildWithMe`, `reviewLetter`. Add `analyseRole` and `buildLetterArchitecture` in this task — leave existing exports untouched. Add a file-local `loadPrompt(filename)` helper (not exported). The import line for schemas needs updating to include the new types.

- [ ] **Step 1: Write the failing tests**

Add these `describe` blocks to `src/modules/writing-guide/actions.test.ts` after the existing `describe('reviewLetter')` block. Also update the import line at the top of the test file:

```ts
// Replace the existing import line for actions and add the type import:
import { generateDraft, buildWithMe, reviewLetter, analyseRole, buildLetterArchitecture } from './actions'
import type { Stage1Brief } from './schema'
```

New tests to append:

```ts
describe('analyseRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns not_found when letter missing', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await analyseRole('missing')
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('calls completeStructured and returns brief', async () => {
    mockLetterFind.mockResolvedValue({
      id: 'letter-1', content: '', jobApplicationId: null, jobTitle: 'PM', company: 'Acme',
      jobApplication: { title: 'PM', company: 'Acme', jobDescription: 'Build product', jobAnalysis: null },
    } as never)
    mockCVFind.mockResolvedValue(null)
    const brief: Stage1Brief = {
      rolePurpose: 'Drive product strategy for enterprise segment',
      topRequirements: ['Product sense', 'Cross-functional leadership', 'Data fluency'],
      track: 'pm',
      selectedProofPoint: 'Led launch of X to 50k users in 3 months',
      gaps: [],
      screenerCriteria: ['Jira'],
      closeFormula: 'Based in London, eligible to work in UK',
    }
    mockCompleteStructured.mockResolvedValue({ object: brief } as never)

    const result = await analyseRole('letter-1')
    expect(result).toEqual({ ok: true, brief })
    expect(mockCompleteStructured).toHaveBeenCalledWith(
      'profile-1',
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ feature: 'cover-letter-analyse', temperature: 0 }),
    )
  })

  it('returns llm error kind on LLMError', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    const { LLMError } = await import('@/modules/llm/errors')
    mockCompleteStructured.mockRejectedValue(new LLMError('No key', 'not_configured'))
    const result = await analyseRole('letter-1')
    expect(result).toEqual({ ok: false, error: 'not_configured', message: 'No key' })
  })
})

describe('buildLetterArchitecture', () => {
  beforeEach(() => vi.clearAllMocks())

  const brief: Stage1Brief = {
    rolePurpose: 'Drive product strategy for enterprise segment',
    topRequirements: ['Product sense', 'Cross-functional leadership', 'Data fluency'],
    track: 'pm',
    selectedProofPoint: 'Led launch of X to 50k users',
    gaps: [],
    screenerCriteria: [],
    closeFormula: 'Based in London',
  }

  it('returns not_found when letter missing', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await buildLetterArchitecture('missing', brief)
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('calls completeStructured with brief JSON in prompt and returns architecture', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    const architecture = {
      hook: 'Acme needs someone to turn ambiguous product bets into shipped outcomes.',
      connection: "That's the work I've done for four years at Unity.",
      proofSetup: 'Led launch of X — 50k users in 3 months.',
      gapAcknowledgement: null,
      closeFormula: 'Based in London, eligible to work in UK.',
    }
    mockCompleteStructured.mockResolvedValue({ object: architecture } as never)

    const result = await buildLetterArchitecture('letter-1', brief)
    expect(result).toEqual({ ok: true, architecture })
    expect(mockCompleteStructured).toHaveBeenCalledWith(
      'profile-1',
      expect.stringContaining('Drive product strategy'),
      expect.anything(),
      expect.objectContaining({ feature: 'cover-letter-architect' }),
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/writing-guide/actions.test.ts 2>&1 | tail -20
```
Expected: FAIL — `analyseRole is not a function`, `buildLetterArchitecture is not a function`

- [ ] **Step 3: Update the schema import line at the top of `actions.ts`**

Replace the existing `ReviewOutputSchema` import:

```ts
import { ReviewOutputSchema, Stage1BriefSchema, Stage2ArchitectureSchema } from './schema'
import type { BuildWithMeInputs, ReviewOutput, Stage1Brief, Stage2Architecture } from './schema'
```

- [ ] **Step 4: Add `loadPrompt` helper and two result types to `actions.ts`**

Add after the existing `loadReviewPrompt` function:

```ts
async function loadPrompt(filename: string): Promise<string> {
  return readFile(path.join(process.cwd(), `src/lib/prompts/${filename}`), 'utf-8')
}

type Stage1Result =
  | { ok: true; brief: Stage1Brief }
  | { ok: false; error: 'not_found'; message: string }
  | { ok: false; error: LLMErrorKind; message: string }

type Stage2Result =
  | { ok: true; architecture: Stage2Architecture }
  | { ok: false; error: 'not_found'; message: string }
  | { ok: false; error: LLMErrorKind; message: string }
```

- [ ] **Step 5: Add `analyseRole` and `buildLetterArchitecture` to `actions.ts` before `generateDraft`**

```ts
export async function analyseRole(letterId: string): Promise<Stage1Result> {
  const { profile } = await requireProfile()
  const inputs = await gatherInputs(profile.id, letterId)
  if (!inputs) return { ok: false, error: 'not_found', message: 'Cover letter not found' }

  const { letter, snapshot, writingCtx, cvMarkdown } = inputs
  const job = letter.jobApplication
  const title = letter.jobTitle ?? job?.title
  const company = letter.company ?? job?.company

  let userPrompt = `# Candidate Profile\n\n${serializeProfileForLLM(snapshot)}`
  if (cvMarkdown) userPrompt += `\n\n# Tailored CV\n\n${cvMarkdown}`
  if (title || company) {
    userPrompt += `\n\n# Role\n\n**${title ?? 'Unknown role'}**${company ? ` at ${company}` : ''}`
  }
  if (job?.jobDescription) {
    userPrompt += `\n\n# Job Description\n\n${job.jobDescription}`
  }

  const stagePrompt = await loadPrompt('cl-stage1-analyse.md')
  const system = composeSystem(writingCtx.rules, writingCtx.brief ?? '', stagePrompt)

  try {
    const result = await completeStructured(profile.id, userPrompt, Stage1BriefSchema, {
      feature: 'cover-letter-analyse',
      temperature: 0,
      maxOutputTokens: 600,
    })
    return { ok: true, brief: result.object }
  } catch (err) {
    if (err instanceof LLMError) return { ok: false, error: err.kind, message: err.message }
    throw err
  }
}

export async function buildLetterArchitecture(
  letterId: string,
  brief: Stage1Brief,
): Promise<Stage2Result> {
  const { profile } = await requireProfile()
  const inputs = await gatherInputs(profile.id, letterId)
  if (!inputs) return { ok: false, error: 'not_found', message: 'Cover letter not found' }

  const userPrompt = `# Stage 1 Brief\n\n${JSON.stringify(brief, null, 2)}`
  const stagePrompt = await loadPrompt('cl-stage2-architecture.md')
  const system = composeSystem(inputs.writingCtx.rules, inputs.writingCtx.brief ?? '', stagePrompt)

  try {
    const result = await completeStructured(profile.id, userPrompt, Stage2ArchitectureSchema, {
      feature: 'cover-letter-architect',
      temperature: 0.3,
      maxOutputTokens: 600,
    })
    return { ok: true, architecture: result.object }
  } catch (err) {
    if (err instanceof LLMError) return { ok: false, error: err.kind, message: err.message }
    throw err
  }
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npx vitest run src/modules/writing-guide/actions.test.ts 2>&1 | tail -20
```
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/writing-guide/actions.ts src/modules/writing-guide/actions.test.ts
git commit -m "feat(writing-guide): add analyseRole and buildLetterArchitecture stage actions"
```

---

### Task 4: Stage 3, 4, 5 actions + remove generateDraft

**Files:**
- Modify: `src/modules/writing-guide/actions.ts`
- Modify: `src/modules/writing-guide/actions.test.ts`

Context: Add the final three stage actions and remove the single-pass `generateDraft` export (it is replaced by the 5-stage flow). `buildWithMe` keeps using `loadGeneratePrompt` — do not remove that helper. Also update the schema imports to include `Stage4IssuesSchema` and `Stage4Issues`.

- [ ] **Step 1: Write the failing tests**

Update the import line in `actions.test.ts` — remove `generateDraft`, add the three new functions and the two new types:

```ts
import { buildWithMe, reviewLetter, analyseRole, buildLetterArchitecture, draftFromArchitecture, reviewDraftPass, finaliseFromReview } from './actions'
import type { Stage1Brief, Stage2Architecture, Stage4Issues } from './schema'
```

Delete the entire `describe('generateDraft', ...)` block (~25 lines). Add these describe blocks after `buildLetterArchitecture`:

```ts
describe('draftFromArchitecture', () => {
  beforeEach(() => vi.clearAllMocks())

  const architecture: Stage2Architecture = {
    hook: 'Acme needs someone to own ambiguous product bets.',
    connection: "That's the work I've done for four years.",
    proofSetup: 'Led launch of X — 50k users in 3 months.',
    gapAcknowledgement: null,
    closeFormula: 'Based in London, eligible to work in UK.',
  }

  it('returns not_found when letter missing', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await draftFromArchitecture('missing', architecture)
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('calls complete with architecture context and returns draft', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    mockComplete.mockResolvedValue({ text: '# Test User\n\nDear Hiring Manager,\n\nDraft body.' } as never)

    const result = await draftFromArchitecture('letter-1', architecture)
    expect(result).toEqual({ ok: true, draft: '# Test User\n\nDear Hiring Manager,\n\nDraft body.' })
    expect(mockComplete).toHaveBeenCalledWith(
      'profile-1',
      expect.stringContaining('Acme needs someone'),
      expect.anything(),
      expect.objectContaining({ feature: 'cover-letter-draft' }),
    )
  })
})

describe('reviewDraftPass', () => {
  beforeEach(() => vi.clearAllMocks())

  const brief: Stage1Brief = {
    rolePurpose: 'Drive product strategy',
    topRequirements: ['Product sense', 'Cross-functional', 'Data'],
    track: 'pm',
    selectedProofPoint: 'Led launch of X',
    gaps: [],
    screenerCriteria: ['Jira'],
    closeFormula: 'Based in London',
  }

  it('returns not_found when letter missing', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await reviewDraftPass('missing', 'draft text', brief)
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('calls completeStructured with draft and brief and returns issues', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    const issues: Stage4Issues = {
      mustFix: [],
      consider: [{ description: 'Em dash on line 3.' }],
      wordCount: 295,
      passesChecklist: true,
    }
    mockCompleteStructured.mockResolvedValue({ object: issues } as never)

    const result = await reviewDraftPass('letter-1', 'Dear Hiring Manager,\n\nBody text.', brief)
    expect(result).toEqual({ ok: true, issues })
    expect(mockCompleteStructured).toHaveBeenCalledWith(
      'profile-1',
      expect.stringContaining('Dear Hiring Manager'),
      expect.anything(),
      expect.objectContaining({ feature: 'cover-letter-review-pass' }),
    )
  })
})

describe('finaliseFromReview', () => {
  beforeEach(() => vi.clearAllMocks())

  const issues: Stage4Issues = {
    mustFix: [{ description: 'Missing data fluency requirement.', suggestedFix: 'Add reference to analytics work in paragraph 2.' }],
    consider: [],
    wordCount: 295,
    passesChecklist: false,
  }

  it('returns not_found when letter missing', async () => {
    mockLetterFind.mockResolvedValue(null)
    const result = await finaliseFromReview('missing', 'draft', issues)
    expect(result).toEqual({ ok: false, error: 'not_found', message: expect.any(String) })
  })

  it('calls complete with draft and issues and returns final content', async () => {
    mockLetterFind.mockResolvedValue({ id: 'letter-1', content: '', jobApplicationId: null, jobTitle: null, company: null, jobApplication: null } as never)
    mockCVFind.mockResolvedValue(null)
    mockComplete.mockResolvedValue({ text: '# Test User\n\nDear Hiring Manager,\n\nFinal body.' } as never)

    const result = await finaliseFromReview('letter-1', 'Dear Hiring Manager,\n\nDraft.', issues)
    expect(result).toEqual({ ok: true, content: '# Test User\n\nDear Hiring Manager,\n\nFinal body.' })
    expect(mockComplete).toHaveBeenCalledWith(
      'profile-1',
      expect.stringContaining('Missing data fluency requirement'),
      expect.anything(),
      expect.objectContaining({ feature: 'cover-letter-finalise' }),
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
npx vitest run src/modules/writing-guide/actions.test.ts 2>&1 | tail -20
```
Expected: FAIL — `draftFromArchitecture`, `reviewDraftPass`, `finaliseFromReview` not found.

- [ ] **Step 3: Update schema imports at top of `actions.ts`**

Replace the import lines added in Task 3 with:

```ts
import { ReviewOutputSchema, Stage1BriefSchema, Stage2ArchitectureSchema, Stage4IssuesSchema } from './schema'
import type { BuildWithMeInputs, ReviewOutput, Stage1Brief, Stage2Architecture, Stage4Issues } from './schema'
```

- [ ] **Step 4: Add Stage3Result, Stage4Result types and three new exported actions to `actions.ts`**

Add after the existing `Stage2Result` type:

```ts
type Stage3Result =
  | { ok: true; draft: string }
  | { ok: false; error: 'not_found'; message: string }
  | { ok: false; error: LLMErrorKind; message: string }

type Stage4Result =
  | { ok: true; issues: Stage4Issues }
  | { ok: false; error: 'not_found'; message: string }
  | { ok: false; error: LLMErrorKind; message: string }
```

Add these three exported functions after `buildLetterArchitecture` and before `generateDraft`:

```ts
export async function draftFromArchitecture(
  letterId: string,
  architecture: Stage2Architecture,
): Promise<Stage3Result> {
  const { profile } = await requireProfile()
  const inputs = await gatherInputs(profile.id, letterId)
  if (!inputs) return { ok: false, error: 'not_found', message: 'Cover letter not found' }

  const { snapshot, writingCtx } = inputs
  const userPrompt = [
    `# Message Architecture\n\n${JSON.stringify(architecture, null, 2)}`,
    `\n\n# Candidate Details\n\n${serializeProfileForLLM(snapshot)}`,
  ].join('')

  const stagePrompt = await loadPrompt('cl-stage3-draft.md')
  const system = composeSystem(writingCtx.rules, writingCtx.brief ?? '', stagePrompt)

  try {
    const result = await complete(profile.id, userPrompt, {
      system,
      feature: 'cover-letter-draft',
      temperature: 0.5,
      maxOutputTokens: 1200,
    })
    return { ok: true, draft: result.text }
  } catch (err) {
    if (err instanceof LLMError) return { ok: false, error: err.kind, message: err.message }
    throw err
  }
}

export async function reviewDraftPass(
  letterId: string,
  draft: string,
  brief: Stage1Brief,
): Promise<Stage4Result> {
  const { profile } = await requireProfile()
  const inputs = await gatherInputs(profile.id, letterId)
  if (!inputs) return { ok: false, error: 'not_found', message: 'Cover letter not found' }

  const { snapshot, writingCtx } = inputs
  const userPrompt = [
    `# Cover Letter Draft\n\n${draft}`,
    `\n\n# Stage 1 Checklist`,
    `\n\nTop 3 requirements:\n${brief.topRequirements.map(r => `- ${r}`).join('\n')}`,
    brief.screenerCriteria.length > 0
      ? `\n\nScreener criteria: ${brief.screenerCriteria.join(', ')}`
      : '',
    `\n\n# Candidate Profile (screener cross-check)\n\n${serializeProfileForLLM(snapshot)}`,
  ].join('')

  const stagePrompt = await loadPrompt('cl-stage4-review.md')
  const system = composeSystem(writingCtx.rules, writingCtx.brief ?? '', stagePrompt)

  try {
    const result = await completeStructured(profile.id, userPrompt, Stage4IssuesSchema, {
      feature: 'cover-letter-review-pass',
      temperature: 0,
      maxOutputTokens: 800,
    })
    return { ok: true, issues: result.object }
  } catch (err) {
    if (err instanceof LLMError) return { ok: false, error: err.kind, message: err.message }
    throw err
  }
}

export async function finaliseFromReview(
  letterId: string,
  draft: string,
  issues: Stage4Issues,
): Promise<GenerateResult> {
  const { profile } = await requireProfile()
  const inputs = await gatherInputs(profile.id, letterId)
  if (!inputs) return { ok: false, error: 'not_found', message: 'Cover letter not found' }

  const mustFixLines = issues.mustFix.length > 0
    ? issues.mustFix.map(i => `- ${i.description}\n  → ${i.suggestedFix}`).join('\n\n')
    : 'None.'
  const considerLines = issues.consider.length > 0
    ? issues.consider.map(i => `- ${i.description}`).join('\n')
    : 'None.'

  const userPrompt = [
    `# Cover Letter Draft\n\n${draft}`,
    `\n\n# Must Fix\n\n${mustFixLines}`,
    `\n\n# Consider (apply voice violations only)\n\n${considerLines}`,
  ].join('')

  const stagePrompt = await loadPrompt('cl-stage5-final.md')
  const system = composeSystem(inputs.writingCtx.rules, inputs.writingCtx.brief ?? '', stagePrompt)

  try {
    const result = await complete(profile.id, userPrompt, {
      system,
      feature: 'cover-letter-finalise',
      temperature: 0.2,
      maxOutputTokens: 1200,
    })
    return { ok: true, content: result.text }
  } catch (err) {
    if (err instanceof LLMError) return { ok: false, error: err.kind, message: err.message }
    throw err
  }
}
```

- [ ] **Step 5: Delete the `generateDraft` exported function from `actions.ts`**

Remove the entire `export async function generateDraft(...)` block (~20 lines). Do NOT remove `loadGeneratePrompt` — `buildWithMe` still uses it.

- [ ] **Step 6: Run all tests**

```bash
npx vitest run src/modules/writing-guide/actions.test.ts 2>&1 | tail -20
```
Expected: all tests PASS.

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```
Expected: no output (clean). If TypeScript complains about `generateDraft` being imported elsewhere, those imports are fixed in Task 5.

- [ ] **Step 8: Commit**

```bash
git add src/modules/writing-guide/actions.ts src/modules/writing-guide/actions.test.ts
git commit -m "feat(writing-guide): add stage 3-5 actions, remove single-pass generateDraft"
```

---

### Task 5: Update generate-mode.tsx — 5-stage progress flow

**Files:**
- Modify: `src/app/dashboard/cover-letters/[id]/guide/_components/generate-mode.tsx`

Context: Replace the single `generateDraft` import and call with 5 sequential stage action calls. State changes from `isPending: boolean` to `progressLabel: string | null` — `null` means idle, any string means in-progress. Each stage updates the label before awaiting. Any stage error shows a toast and resets `progressLabel` to null.

- [ ] **Step 1: Replace the entire file content**

```tsx
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
import {
  analyseRole,
  buildLetterArchitecture,
  draftFromArchitecture,
  reviewDraftPass,
  finaliseFromReview,
} from '@/modules/writing-guide/actions'
import { updateCoverLetterContent } from '@/modules/cover-letters/actions'

type Props = {
  letter: {
    id: string
    content: string
    jobApplication?: { jobDescription?: string | null } | null
  }
  onBack: () => void
}

export function GenerateMode({ letter, onBack }: Props) {
  const [progressLabel, setProgressLabel] = useState<string | null>(null)
  const [pendingContent, setPendingContent] = useState<string | null>(null)
  const router = useRouter()

  const isPending = progressLabel !== null

  async function handleGenerate() {
    setProgressLabel('Analysing role…')

    const briefResult = await analyseRole(letter.id)
    if (!briefResult.ok) {
      setProgressLabel(null)
      toast.error(briefResult.message, {
        action: briefResult.error === 'not_configured'
          ? { label: 'Set up →', onClick: () => router.push('/dashboard/settings/llm') }
          : undefined,
      })
      return
    }

    setProgressLabel('Building message…')
    const archResult = await buildLetterArchitecture(letter.id, briefResult.brief)
    if (!archResult.ok) {
      setProgressLabel(null)
      toast.error(archResult.message)
      return
    }

    setProgressLabel('Writing draft…')
    const draftResult = await draftFromArchitecture(letter.id, archResult.architecture)
    if (!draftResult.ok) {
      setProgressLabel(null)
      toast.error(draftResult.message)
      return
    }

    setProgressLabel('Reviewing…')
    const reviewResult = await reviewDraftPass(letter.id, draftResult.draft, briefResult.brief)
    if (!reviewResult.ok) {
      setProgressLabel(null)
      toast.error(reviewResult.message)
      return
    }

    setProgressLabel('Finalising…')
    const finalResult = await finaliseFromReview(letter.id, draftResult.draft, reviewResult.issues)
    setProgressLabel(null)

    if (!finalResult.ok) {
      toast.error(finalResult.message)
      return
    }

    if (letter.content.trim() !== '') {
      setPendingContent(finalResult.content)
    } else {
      await applyContent(finalResult.content)
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
        AI analyses the role, builds a message structure, writes a draft, reviews it, then finalises. Takes about 30–60 seconds.
      </p>

      {!letter.jobApplication?.jobDescription && (
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
            {progressLabel}
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
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add "src/app/dashboard/cover-letters/[id]/guide/_components/generate-mode.tsx"
git commit -m "feat(writing-guide): 5-stage pipeline in GenerateMode with live progress labels"
```

---

### Task 6: Feature labels

**Files:**
- Modify: `src/app/dashboard/settings/usage/_components/usage-log.tsx`

Context: `FEATURE_LABELS` is a `Record<string, string>` constant near the top of the file. The old `cover-letter-generate` key maps to `'Cover letter — generate draft'`. Remove it and add the 5 new stage keys.

- [ ] **Step 1: Update `FEATURE_LABELS` in usage-log.tsx**

Remove:
```ts
'cover-letter-generate': 'Cover letter — generate draft',
```

Add in its place:
```ts
'cover-letter-analyse':      'Cover letter — analyse role',
'cover-letter-architect':    'Cover letter — build message',
'cover-letter-draft':        'Cover letter — write draft',
'cover-letter-review-pass':  'Cover letter — review draft',
'cover-letter-finalise':     'Cover letter — finalise',
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/settings/usage/_components/usage-log.tsx
git commit -m "feat(writing-guide): add 5-stage feature labels to usage log"
```

---

## Self-review

**Spec coverage (issue #138):**
- ✅ Stage 1 — role purpose, top 3 requirements, track, proof point, gaps, screener criteria, close formula
- ✅ Stage 2 — hook, connection, proof setup, gap decision, close formula
- ✅ Stage 3 — 270–320 words, voice rules enforced in prompt
- ✅ Stage 4 — top-3 checklist check, screener criteria checked against BOTH letter and CV profile, seniority read, voice violations, word count
- ✅ Stage 5 — apply must-fix only, em dash + passive grep steps in prompt
- ✅ No single-pass path for Generate Draft
- ✅ Stage 4 runs as a distinct LLM call, not inline with drafting
- ✅ Build With Me unchanged (single-pass kept per design decision)
- ✅ ✦ Review toolbar unchanged (reviewLetter kept per design decision)
- ✅ Stage-by-stage progress labels shown in GenerateMode UI
- ✅ All 5 feature keys registered in FEATURE_LABELS

**Placeholder scan:** No TBDs, TODOs, or vague steps.

**Type consistency:**
- `Stage1Brief` — defined Task 1, used as param in `buildLetterArchitecture` (Task 3), `reviewDraftPass` (Task 4), `handleGenerate` (Task 5) ✅
- `Stage2Architecture` — defined Task 1, used as param in `draftFromArchitecture` (Task 4), `handleGenerate` (Task 5) ✅
- `Stage4Issues` — defined Task 1, used as param in `finaliseFromReview` (Task 4), `handleGenerate` (Task 5) ✅
- `GenerateResult` reused for `finaliseFromReview` return type — same `{ ok: true; content: string }` shape ✅
- Feature strings in actions: `cover-letter-analyse`, `cover-letter-architect`, `cover-letter-draft`, `cover-letter-review-pass`, `cover-letter-finalise` match FEATURE_LABELS keys in Task 6 ✅
