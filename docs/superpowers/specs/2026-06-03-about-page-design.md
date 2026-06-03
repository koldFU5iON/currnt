# About Page — Design Spec

**Date:** 2026-06-03
**Route:** `/about`
**Status:** Approved

---

## Purpose

A public about page that builds trust through narrative before converting. Audience: new visitors and curious signed-in users. Goal: establish credibility and resonance around the "why" of currnt, with a soft CTA at the end.

---

## Narrative Arc (layout: C)

Single reading column, 65ch max-width, no cards, no sidebar. Seven beats in sequence:

1. **Opening statement** — two punchy lines reframing the job market moment
2. **The moment** — 3 sentences on AI disruption and hiring pressure
3. **The response** — currnt's premise: AI as companion, not replacement; surface critical impact
4. **The philosophy** — water/current metaphor; the missing E as potential
5. **Four beliefs** — monospace label (`— Adaptive`, `— Structured`, `— Current`, `— User-Owned`) + one paragraph each
6. **Open source commitment** — auditable, BYO key, AI works for the user
7. **Soft dual CTA** — "Take control of your career narrative." + `[Get started free]` + `[View on GitHub →]`

Shared nav and footer from the landing page (public shell, no auth required).

---

## Copy

### Opening
> AI is reshaping every industry. Somewhere in the rush, your career became something that happens to you — not something you own.

### The moment
Hiring is faster, noisier, and more competitive than it has ever been. AI is compressing timelines, automating screening, and making it harder to stand out with a static document. Most people are being evaluated before they have had a chance to show what they actually bring.

### The response
currnt is built on a different premise: AI should be a companion in your career, not a replacement for your judgment. The goal is not to automate your identity — it is to surface what is already there and help you communicate it with precision. You bring your experience. currnt helps you show the critical impact behind it.

### The philosophy
Modern careers are no longer ladders. They are currents — they shift, adapt, accelerate, slow down, branch, and evolve. The professionals who thrive are not always the strongest or most experienced. They are the most adaptable.

The name reflects this. currnt. The missing E is deliberate. Every person arrives with something they are pursuing: a new role, a new skill, a new direction. The missing letter represents that potential. Your story is still being written.

### Four beliefs

**— Adaptive**
Modern professionals are multidimensional. You work across operations, communication, product, strategy, and creative — sometimes all at once. currnt reflects that reality rather than forcing your career into someone else's template.

**— Structured**
People forget their own value. currnt turns fragmented experience into organised achievements, reusable evidence, and a structured career memory you can draw from at any time.

**— Current**
Careers evolve constantly. currnt is built to move with you — capturing new experience as it happens and keeping your record relevant so you are ready when the right opportunity arrives.

**— User-Owned**
Your professional identity belongs to you. currnt is open source. You bring your own AI key, choose your workflows, and control your data. The intelligence runs on your account, not ours.

### Open source commitment
You are not feeding your career into a black box. currnt is open source, auditable, and bring-your-own-key. The AI runs on your account. You see everything it does. You approve everything it outputs.

### CTA
Take control of your career narrative.
- Primary: Get started free → `/sign-up`
- Secondary: View on GitHub → external

---

## Entry Points

### Landing page nav
Add "About" as a text link in the existing nav bar, between the GitHub link and "Sign in". Style: `text-sm text-muted-foreground hover:text-foreground`, consistent with existing nav items.

### Dashboard stats bar
Add a single `text-xs text-muted-foreground` link directly below `<StatsRow />` in `dashboard/page.tsx`:
```
Why we built this →   (links to /about)
```
Left-aligned, unobtrusive. Not inside the stats cards.

---

## Files

| Action | File | Notes |
|--------|------|-------|
| Create | `src/app/about/page.tsx` | Public server component, no auth |
| Create | `src/app/about/_components/BeliefSection.tsx` | Four beliefs renderer |
| Update | `src/app/page.tsx` | Add About nav link |
| Update | `src/app/dashboard/page.tsx` | Add link below StatsRow |
| Update | `src/lib/brand.ts` | Add `about` copy object |

No new layout file needed — the about page uses the same public shell pattern as the landing page (nav + content + footer in a single component, no separate layout).

---

## Design constraints

- Single column, `max-w-2xl` reading column, `px-8` padding
- Section breaks: `border-t border-border/60` with `pt-10 mt-10`
- Belief labels: `font-mono text-xs font-semibold text-primary` (matches feature section pillar label style)
- No cards, no icon grids, no hero metrics
- CTA section: same pattern as landing page hero CTA
- Nav and footer: extracted from `page.tsx` into shared components if not already — or duplicated if the about page is the only second public page for now
