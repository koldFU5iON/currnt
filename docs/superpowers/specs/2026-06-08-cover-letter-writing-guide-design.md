# Cover Letter Writing Guide Design

**Issue:** #131

---

## Goal

An optional writing guide that helps users prepare or improve cover letter content. The guide is a separate surface from the workspace — it helps users start or refine a letter, then returns them to the workspace to write. Four modes: static checklist, AI generate draft, AI build with me, and AI review.

---

## Routes

| Route | Purpose |
|---|---|
| `/dashboard/cover-letters/[id]/guide` | Writing Guide — 3-mode starting point |
| `/dashboard/cover-letters/[id]/review` | Review — AI critique of an existing draft |

Both are full-page routes. The side panel in the workspace is intentionally kept free for a future AI assistant phase.

---

## Workspace Toolbar Changes

Two new buttons added to `cover-letter-workspace.tsx`, right side of the toolbar:

- **✦ Writing Guide** — always enabled. Navigates to `/dashboard/cover-letters/[id]/guide`. Also surfaced as a CTA in the existing empty state: "Not sure where to start? Open the writing guide →"
- **✦ Review** — disabled with `title="Write something first"` when `content === ''`; active once content exists. Navigates to `/dashboard/cover-letters/[id]/review`.

---

## Module: `src/modules/writing-guide/`

Separate module per the issue's requirement to keep guide logic isolated from the writing workspace.

```
src/modules/writing-guide/
  schema.ts       — GenerateDraftOutput, ReviewOutputSchema, BuildWithMeInputs Zod schemas + inferred types
  actions.ts      — generateDraft, buildWithMe, reviewLetter server actions
  checklist.ts    — static checklist content (plain data, no AI)
```

### `schema.ts`

```ts
export const BuildWithMeInputs = z.object({
  whyRole: z.string().optional(),
  whyCompany: z.string().optional(),
  bestEvidence: z.string().optional(),
  whyNow: z.string().optional(),
  anythingElse: z.string().optional(),
})

export const ReviewOutputSchema = z.object({
  issues: z.array(z.object({
    category: z.enum(['missing_requirement', 'weak_evidence', 'tone', 'motivation', 'unsupported_claim', 'repetition']),
    severity: z.enum(['high', 'medium', 'low']),
    description: z.string().describe('Plain English explanation of the issue, 1–2 sentences.'),
  })),
  strengths: z.array(z.string().describe('One strength per item, 1 sentence.')),
  summary: z.string().describe('One sentence overall assessment.'),
})

export type BuildWithMeInputs = z.infer<typeof BuildWithMeInputs>
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>
```

`GenerateDraftOutput` is plain text — use `complete()` not `completeStructured()`.

### `actions.ts`

Three server actions. All return a discriminated union (`{ ok: true, ... } | { ok: false, error: LLMErrorKind | 'no_description' | 'not_found', message: string }`).

**`generateDraft(letterId: string)`**
1. `requireProfile()`
2. Fetch cover letter + linked job application (title, company, jobDescription, jobAnalysis)
3. `buildProfileSnapshot` + `serializeProfileForLLM`
4. If `letter.jobApplicationId` exists, query `CVDocument` where `jobApplicationId = letter.jobApplicationId` (take the most recent) to include CV content in the prompt. If no linked job or no CV for that job, omit CV content.
5. Build prompt: profile snapshot + CV content (if found) + job description + job analysis
6. `complete(profileId, prompt, { feature: 'cover-letter-generate', temperature: 0.7, maxOutputTokens: 1200 })`
7. Return `{ ok: true, content: string }`

**`buildWithMe(letterId: string, inputs: BuildWithMeInputs)`**
Same pipeline as `generateDraft` but includes the user's answers in the prompt under a `# Your Context` section. Returns `{ ok: true, content: string }`.

**`reviewLetter(letterId: string)`**
1. `requireProfile()`
2. Fetch letter content + linked job
3. If `content === ''` return `{ ok: false, error: 'no_content', message: '...' }`
4. `completeStructured(profileId, prompt, ReviewOutputSchema, { feature: 'cover-letter-review', temperature: 0, maxOutputTokens: 800 })`
5. Return `{ ok: true, review: ReviewOutput }`

### `checklist.ts`

Plain data export — no functions, no AI. Four sections (Opening, Company interest, Your fit, Closing) each with 2–3 writing prompts as strings.

---

## Routes: File Structure

```
src/app/dashboard/cover-letters/[id]/
  guide/
    page.tsx                        — server component: fetches letter + job, passes to GuideClient
    _components/
      guide-client.tsx              — client component: mode selector state machine
      checklist-mode.tsx            — static checklist display
      generate-mode.tsx             — generate button + loading state + overwrite confirm
      build-with-me-mode.tsx        — form + localStorage persistence + submit
  review/
    page.tsx                        — server component: fetches letter + job, calls reviewLetter, renders results
    _components/
      review-results.tsx            — issues list + strengths + summary
```

---

## Guide Landing (`/[id]/guide`)

Server component fetches the letter and linked job. Passes `{ letter, job, llmConfigured }` to `GuideClient`.

`GuideClient` is a client component with `mode` state: `null | 'checklist' | 'generate' | 'build'`. When `mode === null`, the mode selector is shown.

### Mode selector

Three cards stacked vertically (single column on all sizes):

| Card | Badge | Available when |
|---|---|---|
| Writing checklist | "No AI needed" | Always |
| Generate a draft | "✦ AI" | `llmConfigured` |
| Build with me | "✦ AI" | `llmConfigured` |

When `!llmConfigured`: AI cards are rendered at reduced opacity with `cursor-not-allowed`. Clicking shows a toast: "AI not configured" with action "Set up →" linking to `/dashboard/settings/llm`. A banner below the cards: "✦ AI features require an API key. [Set up →]".

A "← Back to letter" link in the page header navigates back to `/dashboard/cover-letters/[id]`.

---

## Mode: Writing Checklist

Static reference. Four sections rendered as collapsible or plain headings:

- **Opening** — 3 prompts (e.g. "Lead with the specific role and why it caught your attention, not 'I am writing to apply for…'")
- **Company interest** — 2 prompts
- **Your fit** — 3 prompts
- **Closing** — 2 prompts

No form, no submission. A "← Back to letter" link at the bottom.

---

## Mode: Generate Draft

Single "Generate draft" button. On click:

1. Set loading state — disable button, show spinner + "Generating…"
2. Call `generateDraft(letter.id)`
3. On `ok: false` — show toast with error message; `not_configured` error includes "Set up →" action
4. On `ok: true`:
   - If `letter.content === ''`: call `updateCoverLetterContent(letter.id, content)`, navigate to workspace
   - If `letter.content !== ''`: show confirmation dialog — "This will replace your current draft. This can't be undone." — [Cancel] [Replace draft]. On confirm: call `updateCoverLetterContent`, navigate to workspace.

---

## Mode: Build With Me

Single form with five optional textarea fields:

1. Why are you interested in this role?
2. Why are you interested in this company?
3. Which experience or achievement best proves your fit?
4. Why are you making this move now?
5. Is there anything else the hiring manager should know?

**LocalStorage persistence:**
- Key: `writing-guide-${letterId}`
- On every field change: debounced 500ms write to localStorage
- On mount: read from localStorage and pre-populate form
- On successful submission: `localStorage.removeItem(`writing-guide-${letterId}`)`

**Submit flow:** identical to Generate Draft — call `buildWithMe(letter.id, inputs)`, same overwrite confirmation, same navigation on success.

At least one field must be non-empty to enable the submit button. A note below: "All fields are optional — answer as many as you like."

---

## Review Route (`/[id]/review`)

Server component. On render:

1. Fetch letter + linked job via `getCoverLetter`
2. If `content === ''`: redirect to `/dashboard/cover-letters/[id]` (workspace handles the empty state)
3. Call `reviewLetter(letterId)` — this is a server-side AI call on page load
4. On `ok: false`: render an error state with a "← Back to letter" link
5. On `ok: true`: render `ReviewResults`

Page toolbar: "← Back to letter" link left-aligned, "✦ Review — [job title]" as the page title.

### `ReviewResults` component

Layout:

```
[summary sentence — muted, italic]

HIGH PRIORITY
[issue card] ← category badge + description
[issue card]

MEDIUM PRIORITY
[issue card]

LOW PRIORITY
[issue card]

STRENGTHS
• strength 1
• strength 2
```

Each issue card: category badge (e.g. "Missing requirement", "Weak evidence") + plain-English description. No "fix it" button — review is read-only. User returns to the workspace to edit.

If `issues.length === 0`: "No significant issues found. Your letter looks solid." with strengths still shown below.

---

## AI Feature Registration

Add to `FEATURE_LABELS` in `src/app/dashboard/settings/usage/_components/usage-log.tsx`:

```ts
'cover-letter-generate': 'Cover letter — generate draft',
'cover-letter-build':    'Cover letter — build with me',
'cover-letter-review':   'Cover letter — review',
```

---

## Out of Scope

- Storing review feedback in the database
- Version history / draft comparison
- Tone variants or rewrite suggestions from Review
- Scoring / rating the letter
- Re-running Review without navigating back (auto-refresh)
- Linking a standalone cover letter to a job (separate feature)
- AI assistant side panel (future phase — panel reserved intentionally)
