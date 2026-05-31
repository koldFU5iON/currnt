# Rebrand — Sub-project B: Visual System

**Issue:** #43 (rebrand to "currnt") — sub-project B of three (A identity/copy ✓ → **B visual system** → C landing redesign).
**Date:** 2026-05-31
**Status:** Approved (pending spec review)

## Context

Phase A shipped the name + copy. Phase B applies the **visual identity**: typography, a charcoal/cyan dark-first palette, and a `DESIGN.md` reference. The app already styles through semantic tokens (`bg-background`, `text-foreground`, `border-border`, `buttonVariants`, the `.dark` token block), so re-mapping the CSS variables re-themes the **entire** app — landing, dashboard, dialogs — with no per-component edits. Branch stacks on phase A (`feat/issue-43-identity-copy`).

> The brand-guide vault note stayed unreachable (Obsidian API down). Values below were proposed and approved via the visual-companion palette pick (direction "A · Warm Charcoal + Muted Cyan").

**Decisions:** Palette A (warm charcoal + muted cyan); Geist Sans + Geist Mono; default theme → dark (toggle/light retained).

## 1. Typography

- Add the `geist` package (`npm i geist`).
- `src/app/layout.tsx`: replace the `Plus_Jakarta_Sans`/`Fira_Code` loaders with `GeistSans` and `GeistMono` from `geist/font/sans` and `geist/font/mono`. Apply `${GeistSans.variable} ${GeistMono.variable}` on `<html>`.
- `src/app/globals.css`: point the font-family theme tokens at Geist's variables (`--font-geist-sans`, `--font-geist-mono`) instead of `--font-jakarta`/`--font-fira-code`. Remove the now-unused Jakarta/Fira wiring.

## 2. Color tokens (the heart)

Rewrite the values in `globals.css`. **Dark = canonical** (palette A); **light = derived warm-paper**. Express as hex (Tailwind v4 variables accept any CSS color). `--primary` becomes the muted cyan so primary actions/focus/active carry the brand; `--ring` matches.

**Dark (`.dark`)**
| token | value | | token | value |
|---|---|---|---|---|
| background | `#0E0F11` | | primary | `#4FB3BF` |
| foreground | `#ECEDEE` | | primary-foreground | `#0E0F11` |
| card / popover | `#17181B` | | secondary | `#1E2024` |
| card/popover-foreground | `#ECEDEE` | | secondary-foreground | `#ECEDEE` |
| muted | `#1A1C1F` | | accent (hover surface) | `#1E2024` |
| muted-foreground | `#9BA1A6` | | accent-foreground | `#ECEDEE` |
| border / input | `#26282C` | | ring | `#4FB3BF` |
| destructive | `#E5484D` | | sidebar | `#0B0C0E` |

Sidebar tokens mirror the base (sidebar-foreground `#ECEDEE`, sidebar-primary `#4FB3BF`, sidebar-accent `#1E2024`, sidebar-border `#26282C`, sidebar-ring `#4FB3BF`). Charts keep the existing neutral ramp for now.

**Light (`:root`)**
| token | value | | token | value |
|---|---|---|---|---|
| background | `#FCFCFB` | | primary | `#2E8C99` |
| foreground | `#17181B` | | primary-foreground | `#FFFFFF` |
| card / popover | `#FFFFFF` | | secondary | `#F0F0EE` |
| muted | `#F0F0EE` | | accent (hover surface) | `#F0F0EE` |
| muted-foreground | `#6B7177` | | ring | `#2E8C99` |
| border / input | `#E6E6E3` | | sidebar | `#F7F7F5` |

(Light `--primary` is the deeper `#2E8C99` so a cyan button with white text meets AA; dark uses `#4FB3BF` with dark text.)

**Radius:** tighten `--radius` `0.625rem → 0.5rem` for a crisper technical feel.

## 3. Dark-first

`src/app/layout.tsx` `<ThemeProvider>`: `defaultTheme: "system" → "dark"`. Toggle + `localStorage` persistence unchanged. First visit is dark for everyone; light remains a click away.

## 4. Badge contrast — tinted status variants (WCAG AA)

Solid bright fills with white text fail AA (`bg-amber-400 text-white` ≈ 1.5:1). Add reusable tinted variants to `src/components/ui/badge.tsx` (matching the existing `ExtractionPanel` pattern):

```ts
success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
info:    "bg-sky-500/15 text-sky-700 dark:text-sky-400",
```

Apply in `src/app/dashboard/profile/_components/Qualifications.tsx`:
- Replace `proficiencyClass` (solid + white text) with a variant map: native/fluent → `success`, professional → `info`, intermediate → `warning`; fall back to `secondary`. Pass via `variant=` (drop the inline color classes, keep `text-xs capitalize`).
- "Expires soon" badge → `variant="warning"` (drop `bg-amber-400 text-white`).

Verify no other white-on-bright text badge remains.

## 5. `DESIGN.md`

New repo-root `DESIGN.md` codifying: the color token set (dark + light tables above), the cyan-accent usage rule (primary actions / focus / active only — not decoration), type families + scale, spacing/radius, and the tinted status-color convention. Reference for future work and `/impeccable`.

## Out of scope (phase C)
Landing feature-section layout/hierarchy redesign; any structural/layout change. B re-themes + swaps type + fixes badge contrast only.

## Verification
1. `npm run build`/`dev` boots; `npm run typecheck` + `npm run lint` + `npm test` clean.
2. Real-app screenshots in **dark (default)** and light: landing, dashboard home, job-applications list, profile, and a dialog. Confirm Geist is rendering and the cyan accent appears on primary buttons/focus.
3. Contrast: proficiency badges (Native/Professional/Intermediate) and "Expires soon" are legible in both themes; spot-check body/muted text meets AA.
4. Status/meaning colors (completeness red/amber/green dot, destructive) still read correctly on the charcoal palette.
5. First load with cleared `localStorage` is dark.
