# Rebrand — Sub-project C: Landing Feature Section

**Issue:** #43 (rebrand to "currnt") — sub-project C of three (A identity/copy ✓, B visual system ✓, **C landing feature section**).
**Date:** 2026-05-31
**Status:** Approved (pending spec review)

## Context

The landing page's feature block is three identical icon cards — the "AI slop" pattern #43 calls out. Phases A/B already gave it the currnt copy and the charcoal/cyan dark-first theme. This phase replaces that grid with an **editorial alternating-row layout**, each brand pillar paired with a small **product fragment** ("the data is the product"). Hero, nav, trust pills, and footer are unchanged. Branch stacks on phase B (`feat/issue-43-visual-system`).

Approved via visual companion: layout **A** (alternating editorial rows) + treatment **1** (mini product fragments).

## Architecture

Two new presentational, static (no data/logic) components on the marketing page, styled entirely through semantic tokens so they theme in light + dark automatically:

- **`src/app/_components/feature-fragments.tsx`** — three small fragments:
  - `SkillsFragment` — a card of 3-4 skill rows, each with an outline proficiency pill (`border-primary text-primary`).
  - `FitScoreFragment` — a cyan score ring (e.g. "8"), a "Strong fit · Senior PM · Remote" caption, and a one-line justification.
  - `JobRowFragment` — a tracked-job row: title/company, a status pill (`bg-secondary` + cyan dot), and a 5-segment progress bar (`bg-primary` / `bg-border`).
  - Content is fixed illustrative example data (these are marketing visuals, not live data).

- **`src/app/_components/feature-section.tsx`** — `FeatureSection` renders the three rows from `brand.features` (pillar/title/description), pairing each pillar with its fragment via a type-safe `Record<pillar, ReactNode>`. Each row: eyebrow (pillar, mono uppercase, `text-primary`), title, description, and the fragment. Rows alternate sides on `md+` (middle row reversed); stack vertically on mobile (text then fragment, full width). Thin top-border rule between rows.

## Changes to `src/app/page.tsx`

- Replace the entire feature-callouts block:
  ```tsx
  <div className="border-t border-border bg-muted/30">
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 px-8 py-12 sm:grid-cols-3">
      {brand.features.map(...) /* the 3 cards */}
    </div>
  </div>
  ```
  with `<FeatureSection />`.
- Remove the now-unused `FEATURE_ICONS` const and the lucide icons only it used (`LayoutGrid`, `Search`, `FileText`). Keep `Key`, `Check` (trust pills) and `GitHubIcon`.

## Out of scope
Hero / nav / trust pills / footer (unchanged). `PRODUCT.md` positioning expansion (#43) is a separate docs concern, not this UI phase.

## Verification
1. `npm run typecheck` + `npm run lint` + `npm test` clean.
2. Real-app screenshots, **dark (default) and light**: the feature section shows three alternating rows with the skills / fit-score / job-row fragments; copy comes from `brand.features`; accent reads correctly; old 3-card grid is gone.
3. **Responsive:** at ~375px the rows stack cleanly (text above fragment), no overflow; at `md+` they alternate sides.
4. Fragments are legible/AA in both themes (token-driven).
