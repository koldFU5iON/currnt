# Dark Mode — Design

**Issue:** #47 ("Need to add dark mode")
**Date:** 2026-05-31
**Status:** Approved

## Context

The app should support light and dark themes with a one-click toggle. Most groundwork already exists:

- `next-themes@^0.4.6` is already a dependency (unused).
- `globals.css` defines a complete `.dark` token set (`:root` + `.dark` CSS variables) and `@custom-variant dark (&:is(.dark *))`.
- `src/app/layout.tsx` already sets `<html suppressHydrationWarning>` — what next-themes needs.
- Components style with semantic tokens (`bg-background`, `text-foreground`, `bg-accent`, …) plus `dark:` variants.

The only missing pieces are a provider, a toggle control, and a small audit. Keep it simple.

## Decisions

- **Library:** `next-themes` (already installed).
- **Default:** `system` — first visit follows the OS setting.
- **Toggle UX:** one-click `light ⇄ dark` from a Sun/Moon button; manual choice persists to `localStorage`.
- **Placement:** command bar, top-right, immediately left of the assistant (chat) toggle.

## Components

### 1. `ThemeProvider` (`src/components/theme-provider.tsx`)
Thin `"use client"` wrapper re-exporting `next-themes`' `ThemeProvider`. Rendered in `src/app/layout.tsx` inside `<body>`, wrapping the existing `TooltipProvider`/children. Props:
`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`.

### 2. `ThemeToggle` (`src/components/shell/theme-toggle.tsx`)
`"use client"` icon button (`Button variant="ghost" size="icon"`, sized to match the nearby `size-9 [&_svg]:size-5` controls).

- Reads `useTheme()` (`resolvedTheme`, `setTheme`).
- Shows **Sun** when `resolvedTheme === "dark"`, **Moon** when light.
- `onClick`: `setTheme(resolvedTheme === "dark" ? "light" : "dark")`.
- `aria-label="Toggle theme"`.
- **Mounted guard:** until `mounted` is true (set in `useEffect`), render a static placeholder icon so SSR and client markup match (standard next-themes pattern).

### 3. Command bar (`src/components/shell/command-bar.tsx`)
Insert `<ThemeToggle />` before the existing assistant toggle button.

## No-flash / data flow

next-themes injects a head script that applies the `.dark` class before first paint (no FOUC on reload). The `.dark` class on `<html>` activates the existing dark token overrides in `globals.css`; no per-component changes required. Theme persists under the `theme` key in `localStorage`.

## Audit

Sweep for hardcoded non-semantic colors that look wrong in dark; fix only what's jarring. Known spots are fine in both themes (status dot `bg-emerald-500`, dialog overlay `bg-black/10`). No restyle of token-based components.

## Out of scope

- 3-way Light/Dark/System UI (system is the default; manual toggle is light/dark only).
- Per-page theme overrides, themed illustrations, or a settings-page appearance panel.

## Verification

1. Fresh `localStorage` → theme follows OS setting on first load.
2. Click toggle → flips light/dark; reload → choice persists; no flash.
3. Spot-check dashboard, profile, job-applications list, and a dialog in dark mode for contrast/legibility.
4. `npm run typecheck` + `npm run lint` clean.
