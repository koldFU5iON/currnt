# Job Fit: Label Rename, Richer Response, Mobile Drawer

**Issues:** #72 (label rename), #79 (markdown response + info icon), #74 (mobile drawer)
**Date:** 2026-06-01

---

## Overview

Three related improvements to the job-fit feature:

1. **#72** — Replace the current `poor | ok` labels with `unlikely | weak` for a more meaningful, outcome-oriented scale.
2. **#79** — Upgrade the LLM response from plain prose to structured markdown (strengths/weaknesses bullets), rendered via the existing `MarkdownProse` component. Add a transparency info icon explaining how assessment works.
3. **#74** — On mobile, replace the fixed-width popover with a bottom drawer using the existing `Drawer` (vaul) component, via CSS breakpoints.

---

## #72 — Label Rename

### New scale

| Label      | Score | Meaning                                              |
|------------|-------|------------------------------------------------------|
| `unlikely` | 0–2   | Missing core requirements; rejected at first screen  |
| `weak`     | 3–4   | Partial overlap; needs exceptional cover letter      |
| `stretch`  | 5–6   | Meets most requirements but has a meaningful gap     |
| `good`     | 7–8   | Strong baseline match; can credibly compete          |
| `excellent`| 9–10  | Unusually well-aligned across role, level, and stack |

### Changes

**`src/modules/jobs/schema.ts`**
- Update `label` Zod enum: `z.enum(['unlikely', 'weak', 'stretch', 'good', 'excellent'])`
- Update `.describe()` text to reflect new label names

**`src/modules/jobs/job-fit.ts`**
- Update prompt calibration lines:
  - `0–2 (unlikely)` — was `poor`
  - `3–4 (weak)` — was `ok`
  - `5–6 (stretch)`, `7–8 (good)`, `9–10 (excellent)` — unchanged

**`src/app/types/job-application.ts`**
- Update `JobFit.label` union type: `"unlikely" | "weak" | "stretch" | "good" | "excellent"`

**`src/app/dashboard/job-applications/_components/job-fit.tsx`**
- Update `FLAME_STYLES` and `PILL_TEXT_STYLES` record keys to match new labels

### Data migration

Existing `jobFit` JSON blobs stored in `JobApplication.jobFit` use the old label strings. A Prisma migration with raw SQL updates them in place:

```sql
UPDATE "JobApplication"
SET "jobFit" = jsonb_set("jobFit"::jsonb, '{label}', '"unlikely"')
WHERE "jobFit" IS NOT NULL AND "jobFit"->>'label' = 'poor';

UPDATE "JobApplication"
SET "jobFit" = jsonb_set("jobFit"::jsonb, '{label}', '"weak"')
WHERE "jobFit" IS NOT NULL AND "jobFit"->>'label' = 'ok';
```

This runs via `npm run db:migrate` as a named migration (e.g. `rename_job_fit_labels`).

---

## #79 — Markdown Response + Info Icon

### Prompt changes (`src/modules/jobs/job-fit.ts`)

Update the `justification` field description in `JobFitSchema` and the prompt instruction to request structured markdown output:

```
**Strengths:**
- [specific strength grounded in the candidate + role]
- [specific strength]

**Weaknesses:**
- [specific gap or concern]
- [specific gap]

[One sentence overall summary.]
```

- Bump `maxOutputTokens` from `600` to `900`
- Update the trailing prompt instruction from `"Two or three sentences in the justification"` to `"In the justification, use markdown: a Strengths section and a Weaknesses section (2–3 bullets each), then one sentence overall summary."`

### Rendering changes (`src/app/dashboard/job-applications/_components/job-fit.tsx`)

- Replace `<p className="text-xs text-muted-foreground leading-relaxed">{jobFit.justification}</p>` with `<MarkdownProse content={jobFit.justification} />`
- Import `MarkdownProse` from `@/app/dashboard/job-applications/view/[id]/_components/markdown-prose.tsx`
- Widen `PopoverContent` from `w-80` to `w-96` to accommodate bullet lists

### Info icon

Add a `(i)` icon button in the popover footer row alongside "Re-assess". On hover/focus it shows a `<Tooltip>` with:

> "Fit is assessed by comparing your career profile (experience, skills, education) against the job description using an LLM. Your career goals and personal notes are included when available. Scores reflect real-world hiring bars — not a guarantee."

Use the existing `<Tooltip>` / `<TooltipContent>` shadcn components. The icon is `Info` from lucide-react, sized 11, styled `text-muted-foreground`.

---

## #74 — Mobile Drawer

### Approach

CSS-only responsive split inside `job-fit.tsx`. No new hook required. Both branches share the same `open`/`setOpen` state and `handleAssess` logic.

```tsx
{/* Desktop: popover */}
<span className="hidden sm:contents">
  <Popover ...>...</Popover>
</span>

{/* Mobile: bottom drawer */}
<span className="sm:hidden">
  <Drawer open={open} onOpenChange={setOpen}>
    <DrawerTrigger>
      <FitPill fit={jobFit} />
    </DrawerTrigger>
    <DrawerContent>
      {/* Same content sections as PopoverContent */}
    </DrawerContent>
  </Drawer>
</span>
```

The drawer content is identical to the popover content: label + score, justification (markdown), trajectory note, notes-used badge, info icon + re-assess footer. Extract shared content into a `<FitDetail>` internal component to avoid duplication.

---

## Out of scope

- Re-assessing existing jobs to regenerate markdown-formatted justifications (old plain-text justifications will render as a single paragraph via `MarkdownProse`, which is fine)
- Any changes to the job-fit scoring algorithm or LLM provider
