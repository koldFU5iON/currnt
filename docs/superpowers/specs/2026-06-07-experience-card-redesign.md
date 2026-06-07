# Experience Card Redesign

**Date:** 2026-06-07
**Issue:** #115 — Can't edit experience cards on mobile
**File:** `src/app/dashboard/profile/_components/Experience.tsx`

---

## Problem

The experience cards on the profile page use `opacity-0 group-hover:opacity-100` to reveal action buttons. Hover states don't fire on touch devices, making Edit, Activities, and Delete completely inaccessible on mobile. The `ActivityManageDialog` has the same issue on individual activity rows.

Secondary issues:
- The scrollable activity list inside each card is visually noisy
- The "Add Experience" dialog uses a raw `<input type="checkbox">` instead of the shadcn `Checkbox` component
- Delete has no confirmation — one tap permanently removes a role and all its activities

---

## Design

### ExperienceBlock cards

**Header**

Company name, location (with MapPin icon), role title, and date range remain in `CardHeader` as they are today. A `DropdownMenu` trigger (⋯ icon button, always visible) is anchored to the top-right of the header using `flex justify-between items-start`.

**Body**

Replace the scrollable `max-h-48 overflow-y-auto` activity list with two elements:

1. **Count chips** — a green `Responsibilities` chip and an amber `Achievements` chip showing the count of each kind. Only chips with count > 0 are rendered.
2. **Activity previews** — up to 2 lines: the first responsibility (green left-border) and the first achievement (amber left-border). If only one kind exists, only one preview line shows. If no activities exist, neither previews nor chips render — show a muted "No activities yet" placeholder instead.

**Dropdown menu (replaces CardFooter)**

`CardFooter` is removed entirely. The ⋯ `DropdownMenu` contains:
- **Edit details** → navigates to `/dashboard/profile/experience/[id]` (same as current Edit link)
- **Manage activities** → opens `ActivityManageDialog` (same as current Activities button)
- Separator
- **Delete** (destructive colour) → opens delete confirmation

**Delete confirmation**

An `AlertDialog` with title "Delete [company]?" and description "This will permanently remove this role and all its activities." Confirm button is destructive variant. Cancel dismisses without action.

---

### ActivityManageDialog

Individual activity rows use `opacity-0 group-hover:opacity-100` for the edit/delete icon buttons — same mobile problem. Fix: make the buttons always visible. Reduce button size (`h-7 w-7`) to avoid crowding the row. The dialog already has `max-w-lg` so space is sufficient.

---

### ExperienceDialog (Add Experience)

Replace the raw `<input type="checkbox" className="h-4 w-4 ...">` with the shadcn `<Checkbox>` component, wired via a controlled `useState` so the value is available on form submit (since `Checkbox` doesn't emit a native checkbox in `FormData`).

---

## Scope

All changes are contained in `src/app/dashboard/profile/_components/Experience.tsx`.

No schema changes. No new files. No API changes.

**Components — already installed:**
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator` — `@/components/ui/dropdown-menu`
- `Checkbox` — `@/components/ui/checkbox`

**Components — needs installing first:**
- `AlertDialog` — not yet in `src/components/ui/`. Add with `npx shadcn@latest add alert-dialog` before implementing the delete confirmation.

---

## Success criteria

- Edit, Manage activities, and Delete are reachable on a touch device without hover
- Delete cannot be triggered without a confirmation step
- Card body is visually clean — no scrolling list, chips + 2 preview lines max
- `ExperienceDialog` checkbox uses the shadcn component
- All existing functionality (create, edit, delete experience; add/edit/delete activities) continues to work
