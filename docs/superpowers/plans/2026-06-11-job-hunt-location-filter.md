# Job Hunt — Per-Watch Location Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-watch location and remote filtering to the job hunt scan, with a multi-value tag input for entering multiple locations.

**Architecture:** Two new fields on `CompanyWatch` (`searchLocations String[]`, `includeRemote Boolean`) drive a new `matchesLocation` filter applied in `scanCompany` after the existing title keyword filter. The UI gets a `LocationTagsInput` component (chip-style multi-value input) used in both the "Add Company" sheet and a new "Edit Watch" sheet.

**Tech Stack:** Prisma 7 + PostgreSQL `TEXT[]` array, React with react-hook-form Controller, Base UI Checkbox (`@base-ui/react/checkbox`), Vitest

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `prisma/schema/job-hunt.prisma` | Modify | Add `searchLocations String[]` and `includeRemote Boolean @default(true)` to `CompanyWatch` |
| `prisma/migrations/…` | Create (auto) | `npm run db:migrate` generates the SQL |
| `src/modules/job-hunt/schema.ts` | Modify | Add `searchLocations`/`includeRemote` to `AddCompanyInputSchema`; add `UpdateWatchInputSchema` |
| `src/modules/job-hunt/profile-filter.ts` | Modify | Add `matchesLocation()` export |
| `src/modules/job-hunt/profile-filter.test.ts` | Modify | Tests for `matchesLocation` |
| `src/modules/job-hunt/actions.ts` | Modify | Persist location fields in `addCompany`/`addCompanyFromHint`; add `updateWatch` action; apply `matchesLocation` filter in `scanCompany` |
| `src/app/dashboard/job-hunt/_components/location-tags-input.tsx` | Create | Chip-style multi-value location input component |
| `src/app/dashboard/job-hunt/_components/add-company-sheet.tsx` | Modify | Add `LocationTagsInput` + `includeRemote` checkbox fields |
| `src/app/dashboard/job-hunt/_components/edit-watch-sheet.tsx` | Create | Sheet for editing location preferences of an existing watch |
| `src/app/dashboard/job-hunt/_components/company-watch-row.tsx` | Modify | Add edit (pencil) button; show location badges when configured |

---

## Task 1: Schema fields + migration

**Files:**
- Modify: `prisma/schema/job-hunt.prisma`
- Run: `npm run db:migrate`

- [ ] **Step 1: Add fields to the schema**

Replace the current `CompanyWatch` model in `prisma/schema/job-hunt.prisma`:

```prisma
model CompanyWatch {
  id              String    @id @default(cuid())
  profileId       String
  name            String
  website         String
  careersUrl      String?
  atsProvider     String    @default("unknown")
  boardSlug       String?
  confidence      Float     @default(0)
  status          String    @default("active")
  searchLocations String[]  @default([])
  includeRemote   Boolean   @default(true)
  lastScannedAt   DateTime?
  createdAt       DateTime  @default(now())

  profile        Profile         @relation(fields: [profileId], references: [id], onDelete: Cascade)
  discoveredJobs DiscoveredJob[]

  @@index([profileId])
  @@index([profileId, status])
}
```

- [ ] **Step 2: Create and apply the migration**

```bash
npm run db:migrate -- --name add_watch_location_filter
```

Expected: migration file created in `prisma/migrations/`, applied to local Docker DB.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema/job-hunt.prisma prisma/migrations/
git commit -m "feat(job-hunt): add searchLocations and includeRemote fields to CompanyWatch"
```

---

## Task 2: matchesLocation filter + tests

**Files:**
- Modify: `src/modules/job-hunt/profile-filter.ts`
- Modify: `src/modules/job-hunt/profile-filter.test.ts`

- [ ] **Step 1: Write the failing tests first**

Add to `src/modules/job-hunt/profile-filter.test.ts` (after existing describe blocks):

```ts
import { describe, it, expect } from 'vitest'
import { buildKeywords, matchesProfile, matchesLocation } from './profile-filter'

// ... existing tests ...

describe('matchesLocation', () => {
  it('returns true when no locations configured (filter inactive)', () => {
    expect(matchesLocation('New York, US', [], true)).toBe(true)
    expect(matchesLocation('New York, US', [], false)).toBe(true)
  })

  it('returns true for null/empty location (benefit of doubt)', () => {
    expect(matchesLocation(null, ['UK'], true)).toBe(true)
    expect(matchesLocation('', ['UK'], true)).toBe(true)
    expect(matchesLocation('  ', ['UK'], true)).toBe(true)
  })

  it('includes remote when includeRemote is true', () => {
    expect(matchesLocation('Remote', ['UK'], true)).toBe(true)
    expect(matchesLocation('US-Remote', ['UK'], true)).toBe(true)
    expect(matchesLocation('Remote - US', ['UK'], true)).toBe(true)
    expect(matchesLocation('Fully Remote', ['UK'], true)).toBe(true)
  })

  it('excludes remote when includeRemote is false', () => {
    expect(matchesLocation('Remote', ['UK'], false)).toBe(false)
    expect(matchesLocation('US-Remote', ['UK'], false)).toBe(false)
  })

  it('matches configured locations case-insensitively', () => {
    expect(matchesLocation('London, UK', ['UK', 'Ireland'], true)).toBe(true)
    expect(matchesLocation('Dublin, Ireland', ['UK', 'Ireland'], true)).toBe(true)
    expect(matchesLocation('london, uk', ['UK'], true)).toBe(true)
  })

  it('matches partial location strings', () => {
    // "UK" matches "United Kingdom" — substring match
    expect(matchesLocation('London, United Kingdom', ['United Kingdom'], true)).toBe(true)
  })

  it('excludes non-matching locations', () => {
    expect(matchesLocation('New York, US', ['UK', 'Ireland'], false)).toBe(false)
    expect(matchesLocation('Berlin, Germany', ['UK', 'Ireland'], false)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/job-hunt/profile-filter.test.ts
```

Expected: fails with "matchesLocation is not a function"

- [ ] **Step 3: Implement matchesLocation in profile-filter.ts**

Add at the end of `src/modules/job-hunt/profile-filter.ts`:

```ts
export function matchesLocation(
  location: string | null | undefined,
  searchLocations: string[],
  includeRemote: boolean,
): boolean {
  // Filter inactive — include everything
  if (searchLocations.length === 0) return true

  // Unknown location — include (benefit of doubt)
  if (!location?.trim()) return true

  const normalized = location.toLowerCase()

  // "remote" anywhere in the string — catches "Remote", "US-Remote", "Remote - EMEA"
  if (includeRemote && normalized.includes('remote')) return true

  // Case-insensitive substring match against any configured location
  return searchLocations.some(loc => normalized.includes(loc.toLowerCase()))
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/job-hunt/profile-filter.test.ts
```

Expected: all tests pass (existing 17 + 8 new = 25 total)

- [ ] **Step 5: Commit**

```bash
git add src/modules/job-hunt/profile-filter.ts src/modules/job-hunt/profile-filter.test.ts
git commit -m "feat(job-hunt): add matchesLocation filter with remote and location substring matching"
```

---

## Task 3: Schema types + actions

**Files:**
- Modify: `src/modules/job-hunt/schema.ts`
- Modify: `src/modules/job-hunt/actions.ts`

- [ ] **Step 1: Update schema.ts — extend AddCompanyInputSchema and add UpdateWatchInputSchema**

In `src/modules/job-hunt/schema.ts`, replace `AddCompanyInputSchema` and add `UpdateWatchInputSchema` after `AtsHintSchema`:

```ts
export const AddCompanyInputSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: z.string().url('Must be a valid URL'),
  searchLocations: z.array(z.string()).default([]),
  includeRemote: z.boolean().default(true),
})
export type AddCompanyInput = z.infer<typeof AddCompanyInputSchema>

export const UpdateWatchInputSchema = z.object({
  watchId: z.string().min(1),
  searchLocations: z.array(z.string()).default([]),
  includeRemote: z.boolean().default(true),
})
export type UpdateWatchInput = z.infer<typeof UpdateWatchInputSchema>
```

- [ ] **Step 2: Update addCompany in actions.ts — persist location fields**

Find the `prisma.companyWatch.create` call inside `addCompany`. Replace the `data` block:

```ts
const watch = await prisma.companyWatch.create({
  data: {
    profileId: profile.id,
    name,
    website,
    careersUrl: discovery.careersUrl ?? null,
    atsProvider: discovery.provider,
    boardSlug: discovery.boardSlug ?? null,
    confidence: discovery.confidence,
    status,
    searchLocations: parsed.data.searchLocations,
    includeRemote: parsed.data.includeRemote,
  },
  select: { id: true },
})
```

- [ ] **Step 3: Update addCompanyFromHint in actions.ts — persist defaults**

In `addCompanyFromHint`, the `prisma.companyWatch.create` data block already uses `parsed.data` after validation. Add the two fields with their defaults:

```ts
const watch = await prisma.companyWatch.create({
  data: {
    profileId: profile.id,
    name: parsed.data.name,
    website: '',
    atsProvider: parsed.data.provider,
    boardSlug: parsed.data.boardSlug,
    confidence: 1,
    status: 'active',
    searchLocations: [],
    includeRemote: true,
  },
  select: { id: true },
})
```

- [ ] **Step 4: Add updateWatch action**

Add after `removeWatch` in `src/modules/job-hunt/actions.ts`:

```ts
// ── updateWatch ───────────────────────────────────────────────────────────────

import { UpdateWatchInputSchema, type UpdateWatchInput } from './schema'

export async function updateWatch(
  input: UpdateWatchInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = UpdateWatchInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { profile } = await requireProfile()

  await prisma.companyWatch.updateMany({
    where: { id: parsed.data.watchId, profileId: profile.id },
    data: {
      searchLocations: parsed.data.searchLocations,
      includeRemote: parsed.data.includeRemote,
    },
  })

  revalidatePath('/dashboard/job-hunt')
  return { ok: true }
}
```

Add `UpdateWatchInputSchema` and `type UpdateWatchInput` to the existing `from './schema'` import at the top of the file. The file already imports `AddCompanyInputSchema`, `AtsHintSchema`, etc. from there — do not add a second import block.

- [ ] **Step 5: Apply matchesLocation filter in scanCompany**

In `scanCompany`, find the line:

```ts
const matched = listings.filter((j) => matchesProfile(j.title, keywords))
```

Replace with:

```ts
const matched = listings.filter((j) =>
  matchesProfile(j.title, keywords) &&
  matchesLocation(j.location, watch.searchLocations, watch.includeRemote)
)
```

Also add `matchesLocation` to the import from `'./profile-filter'`:

```ts
import { buildKeywords, matchesProfile, matchesLocation, type ProfileFilterData } from './profile-filter'
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/modules/job-hunt/schema.ts src/modules/job-hunt/actions.ts
git commit -m "feat(job-hunt): wire location filter into scan — searchLocations and includeRemote per watch"
```

---

## Task 4: LocationTagsInput component

**Files:**
- Create: `src/app/dashboard/job-hunt/_components/location-tags-input.tsx`

This is a pure controlled component — no server actions, no imports from modules.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState, useRef, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Props = {
  value: string[]
  onChange: (locations: string[]) => void
  placeholder?: string
}

export function LocationTagsInput({
  value,
  onChange,
  placeholder = 'e.g. UK, Ireland — press Enter to add',
}: Props) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed || value.includes(trimmed)) return
    onChange([...value, trimmed])
    setInputValue('')
  }

  function removeTag(tag: string) {
    onChange(value.filter(t => t !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    }
    if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm cursor-text focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-ring"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map(tag => (
        <Badge key={tag} variant="secondary" className="gap-1 text-xs font-normal">
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
            className="hover:text-destructive transition-colors"
            aria-label={`Remove ${tag}`}
          >
            <X className="size-2.5" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue.trim()) addTag(inputValue) }}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-24 bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/job-hunt/_components/location-tags-input.tsx
git commit -m "feat(job-hunt): add LocationTagsInput — chip-style multi-value location input"
```

---

## Task 5: Update AddCompanySheet

**Files:**
- Modify: `src/app/dashboard/job-hunt/_components/add-company-sheet.tsx`

The `AddCompanyInput` type now has `searchLocations` and `includeRemote`. The Checkbox from `@/components/ui/checkbox` uses Base UI's `checked`/`onCheckedChange` props.

- [ ] **Step 1: Update the sheet**

Replace the entire file with:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { LocationTagsInput } from './location-tags-input'
import { addCompany } from '@/modules/job-hunt/actions'
import { AddCompanyInputSchema, type AddCompanyInput } from '@/modules/job-hunt/schema'

export function AddCompanySheet() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const form = useForm<AddCompanyInput>({
    resolver: zodResolver(AddCompanyInputSchema),
    defaultValues: { name: '', website: '', searchLocations: [], includeRemote: true },
  })

  function onSubmit(data: AddCompanyInput) {
    startTransition(async () => {
      const result = await addCompany(data)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Watching ${data.name}`)
      setOpen(false)
      form.reset()
      router.refresh()
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1.5" />
        Add Company
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Watch a Company</SheetTitle>
            <SheetDescription>
              We&apos;ll detect their ATS provider and scan for roles that match your profile.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 py-6">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Company name</FieldLabel>
                  <Input placeholder="MongoDB" {...field} aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="website"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Website</FieldLabel>
                  <Input placeholder="https://www.mongodb.com" {...field} aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="searchLocations"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Locations <span className="text-muted-foreground font-normal">(optional)</span></FieldLabel>
                  <LocationTagsInput value={field.value} onChange={field.onChange} />
                  <p className="text-xs text-muted-foreground">Leave empty to see all locations. Press Enter or comma to add each location.</p>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="includeRemote"
              render={({ field }) => (
                <Field>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="includeRemote"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <FieldLabel htmlFor="includeRemote" className="cursor-pointer">
                      Include remote listings
                    </FieldLabel>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">Includes roles listed as "Remote", "US-Remote", etc.</p>
                </Field>
              )}
            />
          </form>

          <SheetFooter className="px-4">
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={isPending}
              className="w-full"
            >
              {isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {isPending ? 'Detecting ATS…' : 'Watch Company'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/job-hunt/_components/add-company-sheet.tsx
git commit -m "feat(job-hunt): add location and remote fields to AddCompanySheet"
```

---

## Task 6: EditWatchSheet + CompanyWatchRow edit button

**Files:**
- Create: `src/app/dashboard/job-hunt/_components/edit-watch-sheet.tsx`
- Modify: `src/app/dashboard/job-hunt/_components/company-watch-row.tsx`

- [ ] **Step 1: Create EditWatchSheet**

```tsx
'use client'

import { useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Field, FieldLabel } from '@/components/ui/field'
import { Checkbox } from '@/components/ui/checkbox'
import { LocationTagsInput } from './location-tags-input'
import { updateWatch } from '@/modules/job-hunt/actions'
import { UpdateWatchInputSchema, type UpdateWatchInput } from '@/modules/job-hunt/schema'
import type { CompanyWatch } from '@prisma/client'

type Props = {
  watch: CompanyWatch
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditWatchSheet({ watch, open, onOpenChange }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const form = useForm<UpdateWatchInput>({
    resolver: zodResolver(UpdateWatchInputSchema),
    values: {
      watchId: watch.id,
      searchLocations: watch.searchLocations,
      includeRemote: watch.includeRemote,
    },
  })

  function onSubmit(data: UpdateWatchInput) {
    startTransition(async () => {
      const result = await updateWatch(data)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Location filter updated')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit {watch.name}</SheetTitle>
          <SheetDescription>
            Adjust location preferences for this company watch.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 py-6">
          <Controller
            control={form.control}
            name="searchLocations"
            render={({ field }) => (
              <Field>
                <FieldLabel>Locations <span className="text-muted-foreground font-normal">(optional)</span></FieldLabel>
                <LocationTagsInput value={field.value} onChange={field.onChange} />
                <p className="text-xs text-muted-foreground">Leave empty to see all locations. Press Enter or comma to add each location.</p>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="includeRemote"
            render={({ field }) => (
              <Field>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="editIncludeRemote"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <FieldLabel htmlFor="editIncludeRemote" className="cursor-pointer">
                    Include remote listings
                  </FieldLabel>
                </div>
                <p className="text-xs text-muted-foreground ml-6">Includes roles listed as "Remote", "US-Remote", etc.</p>
              </Field>
            )}
          />
        </form>

        <SheetFooter className="px-4">
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Update CompanyWatchRow to add edit button and location badges**

Replace the entire file `src/app/dashboard/job-hunt/_components/company-watch-row.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, Trash2, AlertTriangle, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { scanCompany, removeWatch } from '@/modules/job-hunt/actions'
import { EditWatchSheet } from './edit-watch-sheet'
import type { CompanyWatch } from '@prisma/client'

const PROVIDER_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  unknown: 'Unknown',
}

export function CompanyWatchRow({ watch }: { watch: CompanyWatch }) {
  const [isScanning, startScan] = useTransition()
  const [isRemoving, startRemove] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()

  function handleScan() {
    startScan(async () => {
      const result = await scanCompany(watch.id)
      if (!result.ok) {
        const messages: Record<string, string> = {
          not_found: 'Watch not found',
          no_ats_detected: 'No ATS detected — try updating the careers URL',
          fetch_failed: 'Could not reach the job board. Try again later.',
        }
        toast.error(messages[result.error] ?? 'Scan failed')
        return
      }
      toast.success(
        result.newJobs > 0
          ? `Found ${result.newJobs} new role${result.newJobs === 1 ? '' : 's'}`
          : 'No new roles found',
      )
      router.refresh()
    })
  }

  function handleRemove() {
    startRemove(async () => {
      await removeWatch(watch.id)
      toast.success(`Stopped watching ${watch.name}`)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className="font-medium truncate">{watch.name}</p>
            {watch.searchLocations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {watch.searchLocations.map(loc => (
                  <Badge key={loc} variant="outline" className="text-xs px-1.5 py-0 font-normal">
                    {loc}
                  </Badge>
                ))}
                {watch.includeRemote && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 font-normal text-muted-foreground">
                    + remote
                  </Badge>
                )}
              </div>
            )}
            {watch.lastScannedAt ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last scanned {formatDate(watch.lastScannedAt)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">Never scanned</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {watch.status === 'discovery_failed' ? (
            <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
              <AlertTriangle className="size-3" />
              ATS unknown
            </Badge>
          ) : (
            <Badge variant="secondary">{PROVIDER_LABELS[watch.atsProvider] ?? watch.atsProvider}</Badge>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleScan}
            disabled={isScanning || watch.status === 'discovery_failed'}
          >
            {isScanning ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            <span className="ml-1.5">{isScanning ? 'Scanning…' : 'Scan'}</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditOpen(true)}
            className="text-muted-foreground"
            aria-label="Edit location filter"
          >
            <Pencil className="size-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemove}
            disabled={isRemoving}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <EditWatchSheet watch={watch} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Run all job-hunt tests**

```bash
npx vitest run src/modules/job-hunt/
```

Expected: all tests pass (the `matchesLocation` tests from Task 2 + existing 63)

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/job-hunt/_components/edit-watch-sheet.tsx src/app/dashboard/job-hunt/_components/company-watch-row.tsx
git commit -m "feat(job-hunt): add EditWatchSheet and edit button with location badges on CompanyWatchRow"
```

---

## Final verification

After all tasks:

```bash
npm run typecheck && npx vitest run src/modules/job-hunt/
```

Expected:
- 0 TypeScript errors
- All tests pass (25 profile-filter tests + remaining module tests)

Then do a quick manual smoke test:
1. Navigate to `/dashboard/job-hunt`
2. Click **Add Company** — verify the Locations tag input and "Include remote" checkbox appear
3. Type `UK`, press Enter — chip appears. Type `Ireland`, press Enter — second chip appears.
4. Uncheck "Include remote" — checkbox unchecks
5. Add the company — watch appears with `UK`, `Ireland`, `+ remote` badges hidden (since remote is off)
6. Click the pencil icon on the watch row — EditWatchSheet opens with current values pre-filled
7. Add another location, save — badges update on the row
