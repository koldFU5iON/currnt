# Rebrand Sub-project A: Identity & Copy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the "currnt" name and repositioned copy behind a single source of truth, with no font/color changes.

**Architecture:** A `src/lib/brand.ts` config holds the name (templated through name-bearing copy) and marketing strings; a `<Wordmark />` component renders the name with centralized styling. The landing page, sidebar, and metadata consume both. Renaming = one line in `brand.ts`; restyling the mark (phase B) = one component.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, vitest.

**Spec:** `docs/superpowers/specs/2026-05-31-rebrand-identity-copy-design.md`

---

## File Structure

- Create `src/lib/brand.ts` — identity + copy single source of truth.
- Create `src/lib/brand.test.ts` — invariant tests (no em-dashes, name threading, pillars).
- Create `src/components/brand/wordmark.tsx` — `<Wordmark>` presentation component.
- Modify `src/app/layout.tsx` — metadata title/description from `brand`.
- Modify `src/components/app-sidebar.tsx` — header uses `<Wordmark>`.
- Modify `src/app/page.tsx` — nav wordmark, hero/feature copy from `brand`, em-dashes removed.

Note on tests: `brand.ts` is pure data with real invariants (em-dash ban, rename propagation), so it gets a vitest test (TDD). The component/page changes are presentation with no component-test infra in this repo — they're verified by grep + browser + typecheck/lint, matching the repo's existing posture.

---

### Task 1: Brand config + invariant tests

**Files:**
- Create: `src/lib/brand.ts`
- Test: `src/lib/brand.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/brand.test.ts
import { describe, it, expect } from "vitest"
import { brand } from "./brand"

// Recursively collect every string value in the brand config.
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === "object") return Object.values(value).flatMap(strings)
  return []
}

describe("brand", () => {
  it("contains no em/en dashes (brand guide bans them)", () => {
    for (const s of strings(brand)) {
      expect(s, s).not.toMatch(/[—–]|&mdash;|&ndash;/)
    }
  })

  it("threads the name through name-bearing copy so a rename propagates", () => {
    expect(brand.metaDescription).toContain(brand.name)
    expect(brand.hero.body).toContain(brand.name)
  })

  it("defines the three brand-pillar features in order", () => {
    expect(brand.features.map((f) => f.pillar)).toEqual([
      "Structured",
      "Adaptive",
      "Current",
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/brand.test.ts`
Expected: FAIL — cannot import `./brand` (module missing).

- [ ] **Step 3: Write the brand config**

```ts
// src/lib/brand.ts
const name = "currnt"

export const brand = {
  name,
  tagline: "Stay current.",
  metaDescription: `${name} keeps a structured record of your career and shapes it to fit each role you go after. Open source, bring your own AI key.`,
  hero: {
    eyebrow: "Stay current.",
    title: "Everything you've done, ready for what's next.",
    body: `${name} keeps a structured record of your career and shapes it to fit each role you go after. No job board. No templates. Just your work, presented clearly.`,
  },
  features: [
    {
      pillar: "Structured",
      title: "Structured, not templated",
      description:
        "Capture everything you've done as structured data: roles, skills, wins, without forcing your career into someone else's template.",
    },
    {
      pillar: "Adaptive",
      title: "Adapt to every role",
      description:
        "See how you fit an opportunity, then tailor what you present so each application reflects what that employer needs to see.",
    },
    {
      pillar: "Current",
      title: "Keep your search current",
      description:
        "Track every role you're chasing and keep your record up to date, so you're ready the moment something lands.",
    },
  ],
} as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/brand.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/brand.ts src/lib/brand.test.ts
git commit -m "feat: add brand config single source of truth (#43)"
```

---

### Task 2: Wordmark component

**Files:**
- Create: `src/components/brand/wordmark.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/brand/wordmark.tsx
import { brand } from "@/lib/brand"
import { cn } from "@/lib/utils"

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
} as const

export function Wordmark({
  size = "md",
  className,
}: {
  size?: keyof typeof sizeClasses
  className?: string
}) {
  return (
    <span className={cn("font-semibold lowercase tracking-tight", sizeClasses[size], className)}>
      {brand.name}
    </span>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/brand/wordmark.tsx
git commit -m "feat: add Wordmark component (#43)"
```

---

### Task 3: Metadata from brand

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add the import** (with the other imports near the top)

```ts
import { brand } from '@/lib/brand'
```

- [ ] **Step 2: Replace the `metadata` export**

Replace:
```ts
export const metadata: Metadata = {
  title: 'Job search operations',
  description:
    'Track applications, understand fit, and sharpen how you present yourself. Open source, bring your own AI key.',
}
```
with:
```ts
export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.metaDescription,
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: drive page metadata from brand config (#43)"
```

---

### Task 4: Sidebar wordmark

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Add the import** (with the other component imports)

```ts
import { Wordmark } from "@/components/brand/wordmark"
```

- [ ] **Step 2: Replace the header text block**

Replace:
```tsx
<div className="flex flex-col text-left">
  <span className="font-semibold text-sm">Resume</span>
  <span className="text-xs text-muted-foreground">Job Tracker</span>
</div>
```
with:
```tsx
<div className="flex flex-col text-left">
  <Wordmark size="sm" />
</div>
```

- [ ] **Step 3: Verify in the browser**

Run the dev server; the sidebar header shows `currnt` (icon square unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: use currnt wordmark in sidebar (#43)"
```

---

### Task 5: Landing page copy + nav wordmark + em-dash removal

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add imports** (with the existing imports)

```ts
import { brand } from '@/lib/brand'
import { Wordmark } from '@/components/brand/wordmark'
import { FileText, Search, LayoutGrid, Key, Check } from 'lucide-react'
```
(Replace the existing `lucide-react` import line so icons used below are all present; `FileText, Search, LayoutGrid` order matches the pillar order.)

- [ ] **Step 2: Replace the local `FEATURES` const with an icon list**

Replace the whole `const FEATURES = [ … ] as const` block with:
```ts
// Icons align to brand.features order: Structured, Adaptive, Current
const FEATURE_ICONS = [FileText, Search, LayoutGrid] as const
```

- [ ] **Step 3: Put the wordmark in the nav (both auth states)**

In the `<nav>`, replace the left-hand GitHub link with the wordmark and move "Open source" into the right-hand group. Replace:
```tsx
<a
  href={GITHUB_URL}
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
>
  <GitHubIcon size={15} />
  Open source
</a>
{isAuthenticated ? (
  <Link href="/dashboard" className={buttonVariants({ size: 'sm' })}>
    Go to dashboard &rarr;
  </Link>
) : (
  <div className="flex items-center gap-3">
    <Link
      href="/sign-in"
      className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      Sign in
    </Link>
    <Link href="/sign-up" className={buttonVariants({ size: 'sm' })}>
      Get started
    </Link>
  </div>
)}
```
with:
```tsx
<Wordmark size="md" />
{isAuthenticated ? (
  <Link href="/dashboard" className={buttonVariants({ size: 'sm' })}>
    Go to dashboard &rarr;
  </Link>
) : (
  <div className="flex items-center gap-3">
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      <GitHubIcon size={15} />
      Open source
    </a>
    <Link
      href="/sign-in"
      className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      Sign in
    </Link>
    <Link href="/sign-up" className={buttonVariants({ size: 'sm' })}>
      Get started
    </Link>
  </div>
)}
```

- [ ] **Step 4: Replace the hero eyebrow/h1/body**

Replace:
```tsx
<p className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
  Job search operations
</p>
<h1 className="mb-5 text-5xl font-bold leading-tight tracking-tight">
  Not another job site.
</h1>
<p className="mx-auto mb-7 max-w-lg text-lg leading-relaxed text-muted-foreground">
  Keep track of the roles you&apos;re chasing, understand how well you fit, and sharpen
  how you present yourself &mdash; without the noise of a job board.
</p>
```
with:
```tsx
<p className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
  {brand.hero.eyebrow}
</p>
<h1 className="mb-5 text-5xl font-bold leading-tight tracking-tight">
  {brand.hero.title}
</h1>
<p className="mx-auto mb-7 max-w-lg text-lg leading-relaxed text-muted-foreground">
  {brand.hero.body}
</p>
```

- [ ] **Step 5: Remove the remaining two em-dashes**

Replace `Get started &mdash; it&apos;s free` with `Get started for free`.

Replace:
```tsx
Already using ChatGPT or Claude in your job search? Plug in your own API key &mdash; the
AI runs on your account, not ours.
```
with:
```tsx
Already using ChatGPT or Claude in your job search? Plug in your own API key. The
AI runs on your account, not ours.
```

- [ ] **Step 6: Render feature cards from `brand.features`**

Replace:
```tsx
{FEATURES.map(({ icon: Icon, title, description }) => (
  <div key={title} className="rounded-lg border border-border bg-background p-6">
    <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-md bg-muted">
      <Icon size={15} className="text-muted-foreground" />
    </div>
    <h3 className="mb-2 text-sm font-semibold">{title}</h3>
    <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>
))}
```
with:
```tsx
{brand.features.map(({ title, description }, i) => {
  const Icon = FEATURE_ICONS[i]
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
```

- [ ] **Step 7: Verify no em-dashes remain and it compiles**

Run: `grep -n "&mdash;\|&ndash;\|—" src/app/page.tsx`
Expected: no matches.
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: currnt landing copy + wordmark, remove em-dashes (#43)"
```

---

### Task 6: Full verification

- [ ] **Step 1: Tests + typecheck + lint**

Run: `npm test` (brand suite passes, nothing else broken), `npm run typecheck`, `npm run lint`
Expected: all clean.

- [ ] **Step 2: No stray brand name outside the config**

Run: `grep -rn "currnt" src | grep -v "src/lib/brand.ts"`
Expected: no matches (every usage flows through `brand`/`<Wordmark>`).

- [ ] **Step 3: Browser check (dev server)**

- Landing `/`: nav shows `currnt` wordmark; eyebrow "Stay current."; h1 "Everything you've done, ready for what's next."; three pillar feature titles; no em-dashes.
- Sidebar (`/dashboard/...`): header shows `currnt`.
- Page `<title>` is `currnt`; an inner dashboard page title renders `… · currnt`.

- [ ] **Step 4: Rename test (then revert)**

Temporarily change `name` in `brand.ts` to `"testname"`, reload `/`, confirm the wordmark, metadata, hero body, and meta description all update. Revert back to `"currnt"`.

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin feat/issue-43-identity-copy
gh pr create --base main --title "Rebrand A: currnt identity & copy" --body "Sub-project A of #43 — name + copy behind brand.ts + <Wordmark>. No font/color changes (that's B). Closes nothing yet (epic #43 stays open)."
```

---

## Self-Review

- **Spec coverage:** brand.ts single-source-of-truth (Task 1) ✓; `<Wordmark>` presentation (Task 2) ✓; metadata title/description (Task 3) ✓; sidebar wordmark (Task 4) ✓; nav wordmark + hero + features + em-dash removal (Task 5) ✓; out-of-scope items (fonts/colors/layout) untouched ✓; verification incl. rename + no-stray-name + em-dash grep (Task 6) ✓.
- **Placeholders:** none — every code step shows full code.
- **Type consistency:** `brand` shape defined in Task 1 is consumed unchanged in Tasks 2–5; `<Wordmark size>` keys (`sm|md|lg`) defined in Task 2 match usages (`sm` sidebar, `md` nav); `FEATURE_ICONS` order documented to match `brand.features` order.
