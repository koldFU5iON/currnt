# Rebrand — Sub-project A: Identity & Copy

**Issue:** #43 (rebrand to "currnt") — first of three sub-projects (A identity/copy, B visual system, C landing redesign).
**Date:** 2026-05-31
**Status:** Approved (pending spec review)

## Context

The product ships under the placeholder name "Resume / Job Tracker" with copy that frames it as a job tracker. Brand CI v0.1 (#43) renames it to **currnt** (lowercase) and repositions it as a calm "structured professional memory." This sub-project lands the **name and copy only** — no font or color changes (those are sub-project B). `PRODUCT.md`'s voice governs: calm, intelligent, precise; no hype.

The name is **not fully locked**, so identity must be centralized to a single source of truth: a rename should be a one-line edit, and the wordmark's look should be restyleable in one place for phase B.

> The full brand-guide note (`_Inbox/Resume - Brand CI.md`) was unreachable during design (Obsidian REST API down); this spec follows the decisions captured in issue #43 + `PRODUCT.md`. Exact color/type values are deferred to sub-project B.

## Architecture: one source of truth

**`src/lib/brand.ts`** (new) — identity tokens + name-bearing copy, with the name templated through so a rename propagates from one constant. Plain data (no JSX) so it works in `metadata`, prose, and components alike:

```ts
const name = "currnt"

export const brand = {
  name,
  tagline: "Stay current.",
  metaDescription:
    `${name} keeps a structured record of your career and shapes it to fit each role you go after. Open source, bring your own AI key.`,
  hero: {
    eyebrow: "Stay current.",
    title: "Everything you've done, ready for what's next.",
    body: `${name} keeps a structured record of your career and shapes it to fit each role you go after. No job board. No templates. Just your work, presented clearly.`,
  },
  features: [
    { pillar: "Structured", title: "Structured, not templated",
      description: "Capture everything you've done as structured data: roles, skills, wins, without forcing your career into someone else's template." },
    { pillar: "Adaptive", title: "Adapt to every role",
      description: "See how you fit an opportunity, then tailor what you present so each application reflects what that employer needs to see." },
    { pillar: "Current", title: "Keep your search current",
      description: "Track every role you're chasing and keep your record up to date, so you're ready the moment something lands." },
  ],
} as const
```

**`src/components/brand/wordmark.tsx`** (new) — `<Wordmark size?={"sm"|"md"|"lg"} className? />` renders `brand.name` with consistent styling (lowercase, font-semibold, tracking). Single place to restyle in phase B. No hardcoded name string anywhere else.

**Separation of concerns:** `brand.ts` = data, `<Wordmark>` = presentation. Em-dashes are banned in all copy (use periods / restructured sentences).

## Changes

### `src/app/layout.tsx` — metadata
- `title`: `{ default: brand.name, template: \`%s · ${brand.name}\` }`
- `description`: `brand.metaDescription`

### `src/components/app-sidebar.tsx` — sidebar header
- Replace the "Resume / Job Tracker" text block with `<Wordmark />`. Keep the existing icon square for now (restyled in B); drop the "Job Tracker" subtitle for a cleaner mark.

### `src/app/page.tsx` — landing page (copy + wordmark only; layout/feature-grid redesign is sub-project C)
- **Nav:** add `<Wordmark />` on the left; keep Sign in / Get started on the right; the "Open source" GitHub link stays (nav-right or footer).
- **Hero:** eyebrow → `brand.hero.eyebrow`; `h1` → `brand.hero.title`; body → `brand.hero.body`.
- **Feature cards:** titles/descriptions from `brand.features` (icons/grid layout unchanged this pass).
- **Em-dashes:** remove all three `&mdash;` (hero body, "Get started — it's free", BYO-key note) — reword without dashes.
- Trust pills unchanged.

## Out of scope (later sub-projects)
- Fonts (Jakarta → Geist), color system (charcoal/cyan), dark-first — **sub-project B**.
- Feature-section layout/hierarchy redesign, marketing visual polish — **sub-project C**.
- `DESIGN.md`, `PRODUCT.md` positioning expansion — **B**.

## Verification
1. `grep -rn "&mdash;" src/app/page.tsx` → no matches.
2. Landing page: wordmark in nav, new eyebrow/h1/body, pillar feature titles. Sidebar shows `currnt`. Browser-checked.
3. Page `<title>` is `currnt`; an inner page title renders `… · currnt`.
4. **Rename test:** change `name` in `brand.ts` to a dummy → wordmark, metadata, and name-bearing copy all update; no stray "currnt" remains (`grep -rn "currnt" src` returns only `brand.ts`).
5. `npm run typecheck` + `npm run lint` clean.
