# Rebrand Sub-project C: Landing Feature Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page's identical 3-card feature grid with an editorial alternating-row layout, each brand pillar paired with a small static product fragment.

**Architecture:** Two new presentational components on the marketing page — `feature-fragments.tsx` (three fixed illustrative fragments) and `feature-section.tsx` (alternating rows driven by `brand.features`, pillar→fragment via a type-safe Record). Both style only through semantic tokens, so they theme in light + dark automatically. `page.tsx` swaps the old grid for `<FeatureSection/>`.

**Tech Stack:** Next.js 16 App Router, React, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-05-31-rebrand-landing-feature-section-design.md`

---

## File Structure

- Create `src/app/_components/feature-fragments.tsx` — `SkillsFragment`, `FitScoreFragment`, `JobRowFragment` (static, token-styled).
- Create `src/app/_components/feature-section.tsx` — `FeatureSection` (alternating rows + pillar→fragment map).
- Modify `src/app/page.tsx` — swap the grid for `<FeatureSection/>`; drop the now-unused `FEATURE_ICONS` + its lucide icons.

Tests: these are purely presentational components with no logic, and the repo has no component-test infra. The pillar→fragment mapping is enforced at compile time by a `Record` keyed on the pillar union (a missing/extra pillar is a type error). Verified by typecheck/lint + real-app screenshots (dark + light + responsive) — the repo's established posture.

---

### Task 1: Product fragment components

**Files:**
- Create: `src/app/_components/feature-fragments.tsx`

- [ ] **Step 1: Create the file**

```tsx
// Static, illustrative product fragments for the landing feature section.
// Fixed example content (not live data); styled via semantic tokens so they
// theme in both light and dark.

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-primary px-2 py-0.5 text-[10px] font-medium text-primary">
      {children}
    </span>
  )
}

const SKILLS = [
  { name: "Risk Management", level: "Expert" },
  { name: "Roadmapping", level: "Expert" },
  { name: "Confluence", level: "Advanced" },
  { name: "Smartsheet", level: "Advanced" },
] as const

export function SkillsFragment() {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
      {SKILLS.map((s, i) => (
        <div
          key={s.name}
          className={`flex items-center justify-between py-1.5 ${i < SKILLS.length - 1 ? "border-b border-border" : ""}`}
        >
          <span className="text-xs text-foreground">{s.name}</span>
          <Pill>{s.level}</Pill>
        </div>
      ))}
    </div>
  )
}

export function FitScoreFragment() {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-full border-2 border-primary text-base font-bold text-foreground">
          8
        </div>
        <div>
          <div className="text-xs font-semibold text-foreground">Strong fit</div>
          <div className="text-[11px] text-muted-foreground">Senior PM · Remote</div>
        </div>
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Deep overlap on program leadership and stakeholder scope; light on the fintech domain.
      </p>
    </div>
  )
}

export function JobRowFragment() {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-foreground">Senior Product Manager</div>
          <div className="text-[11px] text-muted-foreground">Anthropic · Remote</div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[10px] text-secondary-foreground">
          <span className="size-1.5 rounded-full bg-primary" /> Applied
        </span>
      </div>
      <div className="mt-2.5 flex gap-1">
        {[true, true, true, false, false].map((on, i) => (
          <span key={i} className={`h-1.5 w-3.5 rounded-full ${on ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/feature-fragments.tsx
git commit -m "feat: add landing product fragment components (#43)"
```

---

### Task 2: FeatureSection component

**Files:**
- Create: `src/app/_components/feature-section.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { brand } from "@/lib/brand"
import {
  SkillsFragment,
  FitScoreFragment,
  JobRowFragment,
} from "./feature-fragments"

// Pillar → fragment. Keyed by the pillar union so a missing/extra pillar is a
// compile-time error.
const PILLAR_FRAGMENT: Record<
  (typeof brand.features)[number]["pillar"],
  React.ReactNode
> = {
  Structured: <SkillsFragment />,
  Adaptive: <FitScoreFragment />,
  Current: <JobRowFragment />,
}

export function FeatureSection() {
  return (
    <div className="border-t border-border">
      <div className="mx-auto max-w-4xl px-8 py-16">
        {brand.features.map(({ pillar, title, description }, i) => (
          <div
            key={pillar}
            className={`flex flex-col gap-6 border-t border-border/60 py-10 first:border-t-0 md:items-center md:gap-12 ${
              i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"
            }`}
          >
            <div className="flex-1">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
                {pillar}
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
            <div className="w-full md:w-72 md:shrink-0">{PILLAR_FRAGMENT[pillar]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/feature-section.tsx
git commit -m "feat: add alternating-row FeatureSection (#43)"
```

---

### Task 3: Wire into the landing page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Trim the lucide import (line 2)**

Replace:
```ts
import { FileText, Search, LayoutGrid, Key, Check } from 'lucide-react'
```
with:
```ts
import { Key, Check } from 'lucide-react'
```

- [ ] **Step 2: Add the FeatureSection import**

Add with the other imports near the top (after the `Wordmark` import):
```ts
import { FeatureSection } from './_components/feature-section'
```

- [ ] **Step 3: Remove the now-unused `FEATURE_ICONS` const**

Delete this block (currently after the `brand`-derived data / before `export default async function Home`):
```ts
const FEATURE_ICONS: Record<(typeof brand.features)[number]["pillar"], typeof FileText> = {
  Structured: FileText,
  Adaptive: Search,
  Current: LayoutGrid,
}
```

- [ ] **Step 4: Replace the feature-callouts block**

Replace:
```tsx
      {/* Feature callouts */}
      <div className="border-t border-border bg-muted/30">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 px-8 py-12 sm:grid-cols-3">
          {brand.features.map(({ pillar, title, description }) => {
            const Icon = FEATURE_ICONS[pillar]
            return (
              <div key={title} className="rounded-lg border border-border bg-background p-6">
                <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                  <Icon size={15} className="text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-sm font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            )
          })}
        </div>
      </div>
```
with:
```tsx
      {/* Feature section */}
      <FeatureSection />
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint`
Expected: clean (no unused-import or unused-var errors).

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: use alternating FeatureSection on landing, drop card grid (#43)"
```

---

### Task 4: Full verification

- [ ] **Step 1: Checks**

Run: `npm run typecheck`, `npm run lint`, `npm test`
Expected: all clean; existing tests still pass.

- [ ] **Step 2: Old grid is gone**

Run: `grep -n "FEATURE_ICONS\|sm:grid-cols-3" src/app/page.tsx`
Expected: no matches.

- [ ] **Step 3: Real-app screenshots (controller does this; implementer may skip)**

Dev server; visit `/` (logged out → dark by default). Capture **dark and light**, and a **~375px** width. Confirm: three alternating rows (text + skills / fit-score / job-row fragments); pillar eyebrows in cyan mono; copy from `brand.features`; rows alternate sides on desktop and stack cleanly on mobile (no overflow); fragments legible in both themes.

- [ ] **Step 4: Push (controller handles PR via finishing-a-development-branch)**

```bash
git push -u origin feat/issue-43-landing-feature-section
```

---

## Self-Review

- **Spec coverage:** `feature-fragments.tsx` with the three fragments (Task 1) ✓; `FeatureSection` alternating rows + pillar→fragment Record (Task 2) ✓; `page.tsx` swap + removal of `FEATURE_ICONS`/unused icons (Task 3) ✓; out-of-scope (hero/nav/footer) untouched ✓; verification incl. dark+light+responsive + old-grid-gone (Task 4) ✓.
- **Placeholders:** none — full code in every create/modify step.
- **Type consistency:** `PILLAR_FRAGMENT` (Task 2) is keyed by `(typeof brand.features)[number]["pillar"]` — the same union used by the removed `FEATURE_ICONS`, and its keys (`Structured`/`Adaptive`/`Current`) match `brand.features` from sub-project A. Fragment component names (`SkillsFragment`/`FitScoreFragment`/`JobRowFragment`) defined in Task 1 are imported unchanged in Task 2. `Key`/`Check` remain imported (still used by `TRUST_PILLS`); `FileText`/`Search`/`LayoutGrid` removed only after their sole user (`FEATURE_ICONS`) is deleted.
