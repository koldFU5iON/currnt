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
