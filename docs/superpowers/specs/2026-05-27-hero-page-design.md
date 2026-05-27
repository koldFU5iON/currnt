# Hero Page Design Spec
**Issue:** #15  
**Date:** 2026-05-27  
**Status:** Approved

---

## Goal

Replace the placeholder `src/app/page.tsx` with a clean, professional hero page that clearly positions the app as a structured job-search operations tool — not a job board. Scope is the landing/hero experience only; auth flows, onboarding, and dashboard are out of scope.

---

## Layout

**Pattern:** Centred single column, `max-w-2xl` content width, full-width surface bands for the feature section.

**Sections (top to bottom):**
1. Nav bar
2. Hero content (eyebrow → headline → sub → trust pills → dual CTA)
3. LLM acknowledgment line
4. Feature callouts (3-column grid, `fafafa` background band)
5. Footer

---

## Section detail

### 1. Nav bar

- Left: GitHub icon + "Open source" link → `https://github.com/koldFU5iON/resume` (opens in new tab)
- Right: "Sign in" text link → `/sign-in` | "Get started" button → `/sign-up`
- **Auth-aware:** if the user is already signed in, replace both right-side elements with a single "Go to dashboard →" button → `/dashboard`
- Bottom border: `border-b border-border`
- No product wordmark or logo

### 2. Hero content

**Eyebrow**
```
Job search operations
```
Small caps, muted, `text-xs font-semibold tracking-widest uppercase text-muted-foreground`

**Headline**
```
Not another job site.
```
`text-5xl font-bold tracking-tight leading-tight` — the positioning statement from issue #15 copy themes.

**Sub-headline**
```
Keep track of the roles you're chasing, understand how well you fit,
and sharpen how you present yourself — without the noise of a job board.
```
`text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto`

**Trust pills** (row of three, `flex-wrap justify-center gap-2`)

| Pill | Icon (Lucide) |
|------|---------------|
| Open source | `Github` |
| Bring your own AI key | `Key` |
| No job board | `Check` |

Pill style: `rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground flex items-center gap-1.5`

**Dual CTA block**

Primary path (hosted):
```
[Get started — it's free]   →  /sign-up
Already have an account? Sign in  →  /sign-in
```

Divider: `── or run it yourself ──` (muted text between two `<hr>` lines)

Self-host path:
```
git clone https://github.com/koldFU5iON/resume.git   [Copy]
View on GitHub →
```
- Clone snippet: `bg-muted border border-border rounded-lg` with inline `<code>` (Fira Code) and a copy-to-clipboard button
- Copy button: client component, uses `navigator.clipboard.writeText()`; shows "Copied!" for 2 seconds then resets
- "View on GitHub →" text link below

**Auth-aware:** When the user is signed in, the entire CTA block (both paths) is replaced by:
```
[Go to dashboard →]
```

### 3. LLM acknowledgment line

```
Already using ChatGPT or Claude in your job search?
Plug in your own API key — the AI runs on your account, not ours.
```

`text-sm text-muted-foreground italic text-center border-t border-border pt-6`

### 4. Feature callouts

Full-width `bg-muted/30 border-t border-border` band. Inner grid: `max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 px-8 py-12`

Three cards, `bg-background border border-border rounded-lg p-6`:

| Card | Icon (Lucide) | Title | Description |
|------|---------------|-------|-------------|
| 1 | `LayoutGrid` | Keep track of the chase | All the roles you're pursuing, in one place. No more piecing it together from emails, tabs, and notes. |
| 2 | `Search` | Understand the fit | See how well your experience matches a role before you apply. Spend your energy where it's most likely to land. |
| 3 | `FileText` | Present yourself clearly | Extract your skills, shape your story, and prepare your pitch — accurately, for each specific opportunity. |

### 5. Footer

`border-t border-border flex items-center justify-between px-8 py-5`

- Left: `Built to help people find work.` — `text-xs text-muted-foreground`
- Right: "Sign in · Get started" text links — `text-xs text-muted-foreground`
- **Auth-aware:** if signed in, right side shows "Go to dashboard →" only

---

## Auth awareness

The page is a **server component**. Session check via a `try/catch` around `requireProfile()` from `src/lib/session.ts`:
- `requireProfile()` throws if not authenticated → catch → render unauthenticated layout
- On success → render authenticated layout (single "Go to dashboard →" CTA, no sign-in/sign-up links)

This avoids any client-side hydration flash and keeps the page fully static for unauthenticated visitors.

---

## Components

### `src/app/page.tsx`
Server component. Checks session, passes `isAuthenticated: boolean` to child components. Renders all five sections.

### `src/app/_components/CloneSnippet.tsx`
Client component. Props: `repo: string`. Renders the copy-to-clipboard code block. Uses `useState` for the "Copied!" flash.

No other new components needed — all other markup is static JSX in `page.tsx`.

---

## Metadata

Update `src/app/layout.tsx` metadata:
```ts
title: 'Job search operations'
description: 'Track applications, understand fit, and sharpen how you present yourself. Open source, bring your own AI key.'
```

---

## Styling constraints

- Uses existing CSS variables from `globals.css` — no new tokens
- Fonts already loaded: `Plus Jakarta Sans` (sans), `Fira Code` (mono)
- Dark mode works automatically via existing `.dark` class strategy
- Responsive: single column on mobile, 3-column feature grid on `sm:` and above
- All interactive elements: `cursor-pointer`, `transition-colors duration-150`
- Focus rings on all keyboard-navigable elements
- Touch targets ≥ 44px on CTA buttons

---

## Out of scope

- Onboarding flow changes
- Dashboard or auth page changes
- Pricing, marketing sections, testimonials
- Any animation beyond `transition-colors`
- SEO/OG image

---

## Acceptance criteria (from issue #15)

- [x] Hero clearly states the product is not a job site/job board
- [x] Hero explains application tracking and pipeline
- [x] Hero explains fit identification
- [x] Hero explains better self-presentation
- [x] Copy acknowledges LLM-assisted workflows without assuming expertise
- [x] Tone is clean, professional, grounded — no "AI will get you hired" language
- [x] Avoids overpromising outcomes
- [x] Works responsively across desktop and mobile
- [x] No placeholder text or internal scaffolding in public copy
- [x] Open source signal present (nav link + trust pill)
- [x] BYO AI key signal present (trust pill + LLM note)
- [x] Self-host path available (clone snippet + GitHub link)
