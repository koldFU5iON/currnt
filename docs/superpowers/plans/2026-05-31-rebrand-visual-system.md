# Rebrand Sub-project B: Visual System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the "currnt" visual identity — Geist type, a warm-charcoal + muted-cyan dark-first palette, AA-safe tinted status badges, and a `DESIGN.md`.

**Architecture:** The app styles through semantic CSS-variable tokens, so re-mapping `:root`/`.dark` in `globals.css` re-themes everything. Fonts swap via the `geist` package + the `--font-sans`/`--font-mono` theme tokens. Dark becomes the default theme. Badge gets reusable tinted status variants.

**Tech Stack:** Next.js 16, Tailwind v4, `geist`, next-themes, vitest.

**Spec:** `docs/superpowers/specs/2026-05-31-rebrand-visual-system-design.md`

---

## File Structure

- Modify `src/app/layout.tsx` — Geist fonts + `defaultTheme: "dark"`.
- Modify `src/app/globals.css` — font tokens, full `:root`/`.dark` palette, radius.
- Modify `src/components/ui/badge.tsx` — add `success`/`warning`/`info` variants.
- Create `src/components/ui/badge.test.ts` — variant class invariants.
- Modify `src/app/dashboard/profile/_components/Qualifications.tsx` — use new variants.
- Create `DESIGN.md` (repo root) — token + convention reference.

Tests: only the badge cva carries logic worth a unit test (TDD). Fonts/colors/theme default/DESIGN.md are config + CSS, verified by build + typecheck/lint + real-app screenshots (the repo's established posture).

---

### Task 1: Geist fonts

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css:10-11`

- [ ] **Step 1: Install the package**

Run: `npm i geist`
Expected: adds `geist` to dependencies.

- [ ] **Step 2: Swap the font loaders in `layout.tsx`**

Replace:
```ts
import { Plus_Jakarta_Sans, Fira_Code } from 'next/font/google'
```
with:
```ts
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
```
Delete these two lines:
```ts
const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'] })
const firaCode = Fira_Code({ variable: '--font-fira-code', subsets: ['latin'] })
```
Change the `<html>` className from:
```tsx
<html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${firaCode.variable}`}>
```
to:
```tsx
<html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
```

- [ ] **Step 3: Point the font tokens at Geist in `globals.css`**

Replace lines 10-11:
```css
  --font-sans: var(--font-jakarta);
  --font-mono: var(--font-fira-code);
```
with:
```css
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
```
(Leave line 12 `--font-heading: var(--font-sans);` as-is.)

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/layout.tsx src/app/globals.css
git commit -m "feat: switch to Geist sans + mono (#43)"
```

---

### Task 2: Charcoal + cyan palette tokens

**Files:**
- Modify: `src/app/globals.css` (the `:root { … }` and `.dark { … }` blocks)

- [ ] **Step 1: Replace the entire `:root { … }` block** with:

```css
:root {
  --background: #FCFCFB;
  --foreground: #17181B;
  --card: #FFFFFF;
  --card-foreground: #17181B;
  --popover: #FFFFFF;
  --popover-foreground: #17181B;
  --primary: #2E8C99;
  --primary-foreground: #FFFFFF;
  --secondary: #F0F0EE;
  --secondary-foreground: #17181B;
  --muted: #F0F0EE;
  --muted-foreground: #6B7177;
  --accent: #F0F0EE;
  --accent-foreground: #17181B;
  --destructive: #E5484D;
  --border: #E6E6E3;
  --input: #E6E6E3;
  --ring: #2E8C99;
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.5rem;
  --sidebar: #F7F7F5;
  --sidebar-foreground: #17181B;
  --sidebar-primary: #2E8C99;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #F0F0EE;
  --sidebar-accent-foreground: #17181B;
  --sidebar-border: #E6E6E3;
  --sidebar-ring: #2E8C99;
}
```

- [ ] **Step 2: Replace the entire `.dark { … }` block** with:

```css
.dark {
  --background: #0E0F11;
  --foreground: #ECEDEE;
  --card: #17181B;
  --card-foreground: #ECEDEE;
  --popover: #17181B;
  --popover-foreground: #ECEDEE;
  --primary: #4FB3BF;
  --primary-foreground: #0E0F11;
  --secondary: #1E2024;
  --secondary-foreground: #ECEDEE;
  --muted: #1A1C1F;
  --muted-foreground: #9BA1A6;
  --accent: #1E2024;
  --accent-foreground: #ECEDEE;
  --destructive: #E5484D;
  --border: #26282C;
  --input: #26282C;
  --ring: #4FB3BF;
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: #0B0C0E;
  --sidebar-foreground: #ECEDEE;
  --sidebar-primary: #4FB3BF;
  --sidebar-primary-foreground: #0E0F11;
  --sidebar-accent: #1E2024;
  --sidebar-accent-foreground: #ECEDEE;
  --sidebar-border: #26282C;
  --sidebar-ring: #4FB3BF;
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: charcoal + muted-cyan palette, tighter radius (#43)"
```

---

### Task 3: Default to dark

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Change the ThemeProvider default**

In the `<ThemeProvider …>` props, change `defaultTheme="system"` to `defaultTheme="dark"`. Leave `attribute`, `enableSystem`, and `disableTransitionOnChange` unchanged.

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: default to dark theme (#43)"
```

---

### Task 4: Tinted status badge variants (TDD)

**Files:**
- Modify: `src/components/ui/badge.tsx`
- Test: `src/components/ui/badge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/ui/badge.test.ts
import { describe, it, expect } from "vitest"
import { badgeVariants } from "./badge"

describe("badgeVariants status variants", () => {
  it("success is a tinted emerald (no white text)", () => {
    const cls = badgeVariants({ variant: "success" })
    expect(cls).toContain("bg-emerald-500/15")
    expect(cls).toContain("text-emerald-700")
    expect(cls).toContain("dark:text-emerald-400")
    expect(cls).not.toContain("text-white")
  })

  it("warning is a tinted amber", () => {
    const cls = badgeVariants({ variant: "warning" })
    expect(cls).toContain("bg-amber-500/15")
    expect(cls).toContain("text-amber-700")
    expect(cls).toContain("dark:text-amber-400")
  })

  it("info is a tinted sky", () => {
    const cls = badgeVariants({ variant: "info" })
    expect(cls).toContain("bg-sky-500/15")
    expect(cls).toContain("text-sky-700")
    expect(cls).toContain("dark:text-sky-400")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/badge.test.ts`
Expected: FAIL — `"success"`/`"warning"`/`"info"` aren't valid variants yet (classes absent / type error).

- [ ] **Step 3: Add the variants to the cva**

In `src/components/ui/badge.tsx`, inside the `variant: { … }` object (after `link:`), add:
```ts
        success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        info: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/badge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/badge.tsx src/components/ui/badge.test.ts
git commit -m "feat: add tinted success/warning/info badge variants (#43)"
```

---

### Task 5: Apply variants to proficiency + expiry badges

**Files:**
- Modify: `src/app/dashboard/profile/_components/Qualifications.tsx`

- [ ] **Step 1: Replace the `proficiencyClass` map (lines ~36-41)**

Replace:
```ts
const proficiencyClass: Record<string, string> = {
  native: "bg-green-500 text-white",
  fluent: "bg-green-400 text-white",
  professional: "bg-blue-500 text-white",
  intermediate: "bg-amber-400 text-white",
}
```
with:
```ts
const proficiencyVariant: Record<string, "success" | "info" | "warning"> = {
  native: "success",
  fluent: "success",
  professional: "info",
  intermediate: "warning",
}
```

- [ ] **Step 2: Update the proficiency Badge usage (line ~324)**

Replace:
```tsx
<Badge className={clsx("text-xs capitalize", proficiencyClass[lang.proficiency] ?? "bg-muted text-muted-foreground")}>
```
with:
```tsx
<Badge variant={proficiencyVariant[lang.proficiency] ?? "secondary"} className="text-xs capitalize">
```

- [ ] **Step 3: Update the "Expires soon" badge (line ~586)**

Replace:
```tsx
{expiringSoon && <Badge className="bg-amber-400 text-white text-xs">Expires soon</Badge>}
```
with:
```tsx
{expiringSoon && <Badge variant="warning" className="text-xs">Expires soon</Badge>}
```

- [ ] **Step 4: Confirm `clsx` is still used elsewhere in the file; if its import is now unused, remove it**

Run: `npm run lint`
Expected: clean (no unused-import error). If lint flags an unused `clsx` import, delete that import line and re-run.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/profile/_components/Qualifications.tsx
git commit -m "fix: AA-safe tinted proficiency + expiry badges (#43)"
```

---

### Task 6: DESIGN.md

**Files:**
- Create: `DESIGN.md` (repo root)

- [ ] **Step 1: Create `DESIGN.md`**

```markdown
# currnt — Design System

Visual identity for **currnt**. Tokens live in `src/app/globals.css` (`:root` = light, `.dark` = canonical). The app is **dark-first** (default theme is dark; light is a derived warm-paper variant).

## Personality
Calm, intelligent, precise (see `PRODUCT.md`). Precision over decoration: white space, type weight, and layout carry the visual weight. The cyan accent is used sparingly.

## Typography
- **Sans / UI / headings:** Geist Sans (`--font-sans`, via the `geist` package).
- **Mono:** Geist Mono (`--font-mono`).

## Color tokens

| Token | Dark (canonical) | Light |
|---|---|---|
| background | `#0E0F11` | `#FCFCFB` |
| foreground | `#ECEDEE` | `#17181B` |
| card / popover | `#17181B` | `#FFFFFF` |
| muted | `#1A1C1F` | `#F0F0EE` |
| muted-foreground | `#9BA1A6` | `#6B7177` |
| border / input | `#26282C` | `#E6E6E3` |
| primary (accent) | `#4FB3BF` | `#2E8C99` |
| primary-foreground | `#0E0F11` | `#FFFFFF` |
| ring | `#4FB3BF` | `#2E8C99` |
| destructive | `#E5484D` | `#E5484D` |
| sidebar | `#0B0C0E` | `#F7F7F5` |

## Accent usage
The muted cyan (`--primary` / `--ring`) is the **only** brand accent. Use it for primary actions, focus rings, and active/selected states — not for decoration or large fills.

## Status colors (meaning, not brand)
Use the tinted badge variants (`success` emerald, `warning` amber, `info` sky) and the completeness dots (red/amber/green). Tinted convention: `bg-{hue}-500/15 text-{hue}-700 dark:text-{hue}-400` — never solid bright fills with white text (fails WCAG AA).

## Spacing & shape
- Radius: `--radius: 0.5rem` (scale `--radius-sm … --radius-4xl` derive from it).
- Tailwind spacing scale; keep layouts airy.

## Accessibility
WCAG AA baseline. Color is never the sole signal. Keyboard navigable throughout.
```

- [ ] **Step 2: Commit**

```bash
git add DESIGN.md
git commit -m "docs: add DESIGN.md token + convention reference (#43)"
```

---

### Task 7: Full verification

- [ ] **Step 1: Build + checks**

Run: `npm run typecheck`, `npm run lint`, `npm test`
Expected: all clean; tests pass (badge suite included).

- [ ] **Step 2: No white-on-bright text badges remain**

Run: `grep -rn "text-white" src/app/dashboard/profile/_components/Qualifications.tsx`
Expected: no matches.

- [ ] **Step 3: Real-app screenshots (controller does this; implementer may skip)**

Dev server; logged-in. Capture **dark (default)** and light: landing `/`, dashboard home, job-applications list, profile, and an open dialog. Confirm: Geist renders; cyan appears on primary buttons + focus rings; proficiency/"Expires soon" badges legible in both themes; completeness dots + destructive still read; fresh `localStorage` loads dark.

- [ ] **Step 4: Push (controller handles PR via finishing-a-development-branch)**

```bash
git push -u origin feat/issue-43-visual-system
```

---

## Self-Review

- **Spec coverage:** Geist sans+mono (Task 1) ✓; palette tokens dark+light + radius (Task 2) ✓; default-to-dark (Task 3) ✓; tinted badge variants (Task 4) + applied to proficiency/"Expires soon" (Task 5) ✓; DESIGN.md (Task 6) ✓; verification incl. contrast + dark-default + no-white-on-bright (Task 7) ✓. Out-of-scope (landing layout) untouched ✓.
- **Placeholders:** none — full code/values in every step.
- **Type consistency:** badge variant names `success`/`warning`/`info` defined in Task 4 are exactly the values used by `proficiencyVariant` and `variant="warning"` in Task 5; token names in Task 2 match the `@theme inline` mappings already in `globals.css`; `--font-geist-sans`/`--font-geist-mono` (Task 1, set by the `geist` package's `.variable`) match the `globals.css` font-token edit.
