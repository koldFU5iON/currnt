# Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `/dashboard/onboarding` redirect with a full 4-step wizard that orients every new user, sets up AI, imports their profile, and lands them at a meaningful first action before they see the dashboard.

**Architecture:** New `(onboarding)` route group (mirrors the existing `(auth)` pattern) with a centered full-page layout and no sidebar chrome. A single `/onboarding` page serves the wizard — step state is client-side in `WizardShell`. The dashboard layout gains a guard that redirects any user with no completed onboarding to `/onboarding`. No DB migration needed — `UserSettings.onboardingCompletedAt` and `onboardingSkippedAt` already exist.

**Tech Stack:** Next.js 16 App Router, React client components, Prisma 7 / PostgreSQL, Tailwind CSS v4, shadcn/ui, Vitest, existing `src/modules/llm/actions.ts`, `src/modules/profile-import/` pipeline, `src/modules/search-profile/actions.ts`.

**Spec:** `docs/superpowers/specs/2026-06-18-onboarding-wizard-design.md`

---

## File Map

**New:**
- `src/app/(onboarding)/layout.tsx` — centered wizard layout, no sidebar or nav
- `src/app/(onboarding)/onboarding/page.tsx` — server component; loads initial state, guards re-entry
- `src/app/(onboarding)/onboarding/_components/WizardShell.tsx` — `'use client'` step machine + progress bar
- `src/app/(onboarding)/onboarding/_components/steps/Step1Ai.tsx` — LLM provider + key + model selector
- `src/app/(onboarding)/onboarding/_components/steps/Step2Profile.tsx` — LinkedIn / CV import
- `src/app/(onboarding)/onboarding/_components/steps/Step3Context.tsx` — search context form
- `src/app/(onboarding)/onboarding/_components/steps/Step4Start.tsx` — first action picker

**Modified:**
- `src/modules/onboarding/queries.ts` — add `getOnboardingStatus(profileId)`
- `src/modules/onboarding/actions.ts` — add `completeOnboarding(destination)`
- `src/app/dashboard/layout.tsx` — add onboarding guard
- `src/app/dashboard/page.tsx` — remove stale `searchProfileHasContent` redirect
- `src/app/dashboard/onboarding/page.tsx` — update stale redirect

---

### Task 1: `getOnboardingStatus` query

**Files:**
- Modify: `src/modules/onboarding/queries.ts`
- Test: `src/modules/onboarding/queries.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/onboarding/queries.test.ts`:

```ts
import { expect, test } from 'vitest'
import { getOnboardingStatus } from './queries'

test('getOnboardingStatus is exported as a function', () => {
  expect(typeof getOnboardingStatus).toBe('function')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/modules/onboarding/queries.test.ts
```
Expected: FAIL — `getOnboardingStatus` not exported.

- [ ] **Step 3: Add `getOnboardingStatus` to `src/modules/onboarding/queries.ts`**

Add after the existing `getOnboardingSettings` function. The existing `prisma` import from `@/lib/db` is already at the top.

```ts
export async function getOnboardingStatus(profileId: string): Promise<{ isComplete: boolean }> {
  const settings = await prisma.userSettings.findUnique({
    where: { profileId },
    select: { onboardingCompletedAt: true, onboardingSkippedAt: true },
  })
  return {
    isComplete: Boolean(settings?.onboardingCompletedAt || settings?.onboardingSkippedAt),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/modules/onboarding/queries.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/onboarding/queries.ts src/modules/onboarding/queries.test.ts
git commit -m "feat(onboarding): add getOnboardingStatus query"
```

---

### Task 2: `completeOnboarding` server action

**Files:**
- Modify: `src/modules/onboarding/actions.ts`

- [ ] **Step 1: Add `completeOnboarding` to `src/modules/onboarding/actions.ts`**

Append to the end of the file. All imports (`prisma`, `requireProfile`, `revalidatePath`, `redirect`) are already present.

```ts
export async function completeOnboarding(destination: string) {
  const { profile } = await requireProfile()

  await prisma.userSettings.upsert({
    where: { profileId: profile.id },
    create: {
      profileId: profile.id,
      onboardingCompletedAt: new Date(),
    },
    update: {
      onboardingCompletedAt: new Date(),
    },
  })

  revalidatePath('/dashboard')
  redirect(destination)
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/onboarding/actions.ts
git commit -m "feat(onboarding): add completeOnboarding server action"
```

---

### Task 3: Dashboard guard + remove old redirects

**Files:**
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/onboarding/page.tsx`

- [ ] **Step 1: Replace `src/app/dashboard/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { AppShell } from '@/components/shell/app-shell'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { PageContextProvider } from '@/lib/context/page-context'
import { requireProfile } from '@/lib/session'
import { getActiveJobsForNav } from '@/modules/jobs/queries'
import { getSuggestionCount } from '@/modules/search-profile/queries'
import { getOnboardingStatus } from '@/modules/onboarding/queries'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile()
  const [activeJobs, suggestionCount, onboardingStatus] = await Promise.all([
    getActiveJobsForNav(profile.id),
    getSuggestionCount(profile.id),
    getOnboardingStatus(profile.id),
  ])

  if (!onboardingStatus.isComplete) redirect('/onboarding')

  return (
    <SidebarProvider>
      <PageContextProvider>
        <AppSidebar activeJobs={activeJobs} suggestionCount={suggestionCount} />
        <SidebarInset>
          <AppShell>{children}</AppShell>
        </SidebarInset>
      </PageContextProvider>
    </SidebarProvider>
  )
}
```

- [ ] **Step 2: Remove the `searchProfileHasContent` redirect from `src/app/dashboard/page.tsx`**

Open `src/app/dashboard/page.tsx`. Remove these two lines:

```tsx
// DELETE these two lines:
if (!searchProfileHasContent(searchProfile)) redirect("/dashboard/search-context")
```

Also remove `searchProfileHasContent` from the import line (keep `getSearchProfile`) and remove the `redirect` import if it is no longer used elsewhere in that file.

The remaining top of the default export should look like:

```tsx
const { profile, searchProfile } = await getSearchProfile()
const displayName = searchProfile.preferredName || profile.name || "there"
```

- [ ] **Step 3: Update `src/app/dashboard/onboarding/page.tsx`**

Replace the file entirely:

```tsx
import { redirect } from 'next/navigation'

export default function Page() {
  redirect('/dashboard')
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/layout.tsx src/app/dashboard/page.tsx src/app/dashboard/onboarding/page.tsx
git commit -m "feat(onboarding): dashboard guard + remove stale search-context redirect"
```

---

### Task 4: Onboarding route group layout

**Files:**
- Create: `src/app/(onboarding)/layout.tsx`

- [ ] **Step 1: Create `src/app/(onboarding)/layout.tsx`**

```tsx
import { Logo } from '@/components/brand/logo'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex justify-center">
          <Logo variant="stacked" size="lg" />
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}
```

`max-w-lg` (512 px) is wider than the auth pages (`max-w-sm`) to accommodate provider cards and import UI.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(onboarding)/layout.tsx"
git commit -m "feat(onboarding): add onboarding route group layout"
```

---

### Task 5: WizardShell — step machine

**Files:**
- Create: `src/app/(onboarding)/onboarding/_components/WizardShell.tsx`

- [ ] **Step 1: Create `src/app/(onboarding)/onboarding/_components/WizardShell.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Step1Ai } from './steps/Step1Ai'
import { Step2Profile } from './steps/Step2Profile'
import { Step3Context } from './steps/Step3Context'
import { Step4Start } from './steps/Step4Start'

type ProviderModel = { id: string; name: string }

export type WizardShellProps = {
  initialLlmStatus: {
    configured: boolean
    provider: string
    model: string
    availableModels: ProviderModel[] | null
  }
  initialProfileImported: boolean
  initialCurrentRole: string
}

const STEP_LABELS = ['AI setup', 'Your profile', 'Search context', 'Get started'] as const

export function WizardShell({
  initialLlmStatus,
  initialProfileImported,
  initialCurrentRole,
}: WizardShellProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)

  function advance() {
    if (step < 3) setStep((s) => (s + 1) as 0 | 1 | 2 | 3)
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex gap-1.5">
          {([0, 1, 2, 3] as const).map((i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                i <= step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-right">
          Step {step + 1} of 4 — {STEP_LABELS[step]}
        </p>
      </div>

      {/* Step content */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        {step === 0 && (
          <Step1Ai initialStatus={initialLlmStatus} onNext={advance} onSkip={advance} />
        )}
        {step === 1 && (
          <Step2Profile
            initialProfileImported={initialProfileImported}
            onNext={advance}
            onSkip={advance}
          />
        )}
        {step === 2 && (
          <Step3Context
            initialCurrentRole={initialCurrentRole}
            onNext={advance}
            onSkip={advance}
          />
        )}
        {step === 3 && <Step4Start />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck (step imports will fail until Tasks 6–9 are done — that's expected)**

```bash
npm run typecheck 2>&1 | grep -v "Cannot find module './steps"
```
Expected: no errors beyond the missing step modules.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(onboarding)/onboarding/_components/WizardShell.tsx"
git commit -m "feat(onboarding): WizardShell step machine"
```

---

### Task 6: Step1Ai — LLM provider setup

**Files:**
- Create: `src/app/(onboarding)/onboarding/_components/steps/Step1Ai.tsx`
- Test: `src/app/(onboarding)/onboarding/_components/steps/Step1Ai.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/(onboarding)/onboarding/_components/steps/Step1Ai.test.ts`:

```ts
import { expect, test } from 'vitest'
import { getProviderKeyUrl } from './Step1Ai'

test('returns Anthropic console URL', () => {
  expect(getProviderKeyUrl('anthropic')).toBe('https://console.anthropic.com/keys')
})

test('returns OpenAI platform URL', () => {
  expect(getProviderKeyUrl('openai')).toBe('https://platform.openai.com/api-keys')
})

test('returns Google AI Studio URL', () => {
  expect(getProviderKeyUrl('google')).toBe('https://aistudio.google.com/app/apikey')
})

test('returns empty string for unknown provider', () => {
  expect(getProviderKeyUrl('unknown')).toBe('')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run "src/app/\(onboarding\)/onboarding/_components/steps/Step1Ai.test.ts"
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/app/(onboarding)/onboarding/_components/steps/Step1Ai.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Check, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { saveLLMApiKey, saveLLMModel, refreshModels } from '@/modules/llm/actions'
import { toast } from 'sonner'

type ProviderModel = { id: string; name: string }

type Props = {
  initialStatus: {
    configured: boolean
    provider: string
    model: string
    availableModels: ProviderModel[] | null
  }
  onNext: () => void
  onSkip: () => void
}

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic', description: 'Claude — strong reasoning & long context' },
  { value: 'openai',    label: 'OpenAI',    description: 'GPT-4 — widely tested' },
  { value: 'google',    label: 'Google',    description: 'Gemini — multimodal' },
] as const

export function getProviderKeyUrl(provider: string): string {
  const urls: Record<string, string> = {
    anthropic: 'https://console.anthropic.com/keys',
    openai:    'https://platform.openai.com/api-keys',
    google:    'https://aistudio.google.com/app/apikey',
  }
  return urls[provider] ?? ''
}

export function Step1Ai({ initialStatus, onNext, onSkip }: Props) {
  const [provider, setProvider] = useState(initialStatus.provider || 'anthropic')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keyConfigured, setKeyConfigured] = useState(initialStatus.configured)
  const [availableModels, setAvailableModels] = useState<ProviderModel[] | null>(
    initialStatus.availableModels,
  )
  const [selectedModel, setSelectedModel] = useState(initialStatus.model)
  const [saving, startSaveTransition] = useTransition()
  const [refreshing, startRefreshTransition] = useTransition()
  const [modelSaving, startModelSaveTransition] = useTransition()

  function handleProviderChange(next: string) {
    setProvider(next)
    setAvailableModels(null)
  }

  function handleSaveKey() {
    if (!apiKey.trim()) return
    startSaveTransition(async () => {
      try {
        const { models } = await saveLLMApiKey({ provider, apiKey })
        setKeyConfigured(true)
        setAvailableModels(models)
        setSelectedModel(models[0]?.id ?? '')
        setApiKey('')
        if (models[0]) await saveLLMModel(models[0].id)
        toast.success('Key saved and models loaded')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save key')
      }
    })
  }

  function handleModelSelect(modelId: string) {
    setSelectedModel(modelId)
    startModelSaveTransition(async () => {
      try {
        await saveLLMModel(modelId)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save model')
      }
    })
  }

  function handleRefresh() {
    startRefreshTransition(async () => {
      try {
        const models = await refreshModels()
        setAvailableModels(models)
        toast.success('Models refreshed')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't load models — try refreshing")
      }
    })
  }

  const isBusy = saving || refreshing
  const keyUrl = getProviderKeyUrl(provider)

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">AI setup</p>
        <h2 className="text-xl font-bold tracking-tight">Make Currnt work harder for you</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your own AI provider — costs land on your account, not ours. You can always update this in Settings.
        </p>
      </div>

      {/* Provider selection */}
      <div className="space-y-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => handleProviderChange(p.value)}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
              provider === p.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50',
            )}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </div>
            <div
              className={cn(
                'h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                provider === p.value
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground/50',
              )}
            />
          </button>
        ))}
      </div>

      {/* API key */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="onboarding-api-key">API Key</Label>
          <div className="flex items-center gap-3">
            {keyConfigured && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <Check size={11} /> Saved
              </span>
            )}
            {keyUrl && (
              <a
                href={keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Get a key →
              </a>
            )}
          </div>
        </div>
        <div className="flex rounded-md border overflow-hidden">
          <Input
            id="onboarding-api-key"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
            placeholder={keyConfigured ? '•••••••• (leave blank to keep)' : 'Paste your API key…'}
            autoComplete="off"
            disabled={isBusy}
            className="border-0 rounded-none flex-1 font-mono focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <button
            type="button"
            onClick={handleSaveKey}
            disabled={isBusy || !apiKey.trim()}
            aria-label="Save API key"
            className="px-3 border-l bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? 'Hide key' : 'Show key'}
            className="px-3 border-l bg-muted text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Encrypted at rest. Saves key and loads available models.</p>
      </div>

      {/* Model selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Model</Label>
          {keyConfigured && availableModels !== null && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
            >
              {refreshing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              Refresh
            </button>
          )}
        </div>
        {!keyConfigured ? (
          <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
            Save a key first
          </div>
        ) : availableModels === null ? (
          <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground gap-2">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Fetching models…' : 'No models loaded — refresh to retry'}
          </div>
        ) : (
          <select
            value={selectedModel}
            onChange={(e) => handleModelSelect(e.target.value)}
            disabled={modelSaving || isBusy}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        {availableModels !== null && (
          <p className="text-xs text-muted-foreground">
            {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} · saves on select
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Skip — I'll set this up in Settings later
        </button>
        {keyConfigured && selectedModel && (
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run "src/app/\(onboarding\)/onboarding/_components/steps/Step1Ai.test.ts"
```
Expected: PASS — 4 tests.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: no errors (WizardShell still complains about missing Step2–4 until those tasks run).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(onboarding)/onboarding/_components/steps/Step1Ai.tsx" \
        "src/app/(onboarding)/onboarding/_components/steps/Step1Ai.test.ts"
git commit -m "feat(onboarding): Step1Ai — LLM provider setup"
```

---

### Task 7: Step2Profile — LinkedIn / CV import

**Files:**
- Create: `src/app/(onboarding)/onboarding/_components/steps/Step2Profile.tsx`

Reuses `extractProfileFromPdf` and `commitImportedProfile` from the existing import pipeline (same functions as `ImportProfileDialog`). Passes an empty `Set()` as `excluded` — the wizard commits everything on import; users can edit their profile afterwards.

- [ ] **Step 1: Create `src/app/(onboarding)/onboarding/_components/steps/Step2Profile.tsx`**

```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { CheckCircle2, Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { extractProfileFromPdf } from '@/modules/profile-import/extract'
import { commitImportedProfile } from '@/modules/profile-import/commit'
import { toast } from 'sonner'

type ImportMode = 'linkedin' | 'cv'
type Stage =
  | { name: 'idle' }
  | { name: 'extracting' }
  | { name: 'committing' }
  | { name: 'done' }
  | { name: 'error'; message: string }

type Props = {
  initialProfileImported: boolean
  onNext: () => void
  onSkip: () => void
}

export function Step2Profile({ initialProfileImported, onNext, onSkip }: Props) {
  const [mode, setMode] = useState<ImportMode>('linkedin')
  const [stage, setStage] = useState<Stage>({ name: initialProfileImported ? 'done' : 'idle' })
  const [, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const isReentry = initialProfileImported && stage.name === 'done'

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setStage({ name: 'error', message: 'Choose a file first.' })
      return
    }
    setStage({ name: 'extracting' })
    const fd = new FormData()
    fd.set('file', file)
    const result = await extractProfileFromPdf(fd)
    if (!result.ok) {
      setStage({ name: 'error', message: result.message ?? 'Import failed — try again or skip.' })
      return
    }
    setStage({ name: 'committing' })
    startTransition(async () => {
      try {
        await commitImportedProfile(result.data, new Set())
        setStage({ name: 'done' })
        toast.success('Profile imported')
      } catch (err) {
        setStage({ name: 'error', message: err instanceof Error ? err.message : 'Commit failed.' })
      }
    })
  }

  const busy = stage.name === 'extracting' || stage.name === 'committing'

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Your profile</p>
        <h2 className="text-xl font-bold tracking-tight">Let's build your profile</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Import your experience so Currnt can score job fit and tailor your applications. LinkedIn gives the best results.
        </p>
      </div>

      {isReentry ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Profile already imported</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Your experience and skills are loaded. Continue to the next step, or re-import to replace.
            </p>
            <button
              type="button"
              onClick={() => setStage({ name: 'idle' })}
              className="mt-2 text-xs text-emerald-700 underline hover:text-emerald-900"
            >
              Re-import
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Mode tabs */}
          <div className="flex gap-2">
            {(['linkedin', 'cv'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 rounded-md border py-2 text-sm font-medium transition-colors',
                  mode === m
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                )}
              >
                {m === 'linkedin' ? 'LinkedIn (recommended)' : 'Upload CV'}
              </button>
            ))}
          </div>

          {mode === 'linkedin' && (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
              <p className="text-sm font-semibold text-blue-800">Export your LinkedIn profile</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Go to your LinkedIn profile page</li>
                <li>Click <strong>More → Save to PDF</strong></li>
                <li>Upload the downloaded PDF below</li>
              </ol>
              <label
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-blue-300 p-6 cursor-pointer transition-colors hover:border-blue-500',
                  busy && 'pointer-events-none opacity-60',
                )}
              >
                {busy
                  ? <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  : <Upload size={20} className="text-blue-500" />
                }
                <span className="text-xs text-muted-foreground text-center">
                  {stage.name === 'extracting'
                    ? 'Extracting profile…'
                    : stage.name === 'committing'
                    ? 'Saving…'
                    : 'Drop LinkedIn PDF here, or click to browse'}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="sr-only"
                  onChange={handleUpload}
                  disabled={busy}
                />
              </label>
            </div>
          )}

          {mode === 'cv' && (
            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <p className="text-sm font-semibold">Upload your CV</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PDF only — quality varies across formats, we'll extract what we can.
                </p>
              </div>
              <label
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 cursor-pointer transition-colors hover:border-primary/50',
                  busy && 'pointer-events-none opacity-60',
                )}
              >
                {busy
                  ? <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  : <Upload size={20} className="text-muted-foreground" />
                }
                <span className="text-xs text-muted-foreground">
                  {stage.name === 'extracting'
                    ? 'Extracting…'
                    : stage.name === 'committing'
                    ? 'Saving…'
                    : 'Drop PDF here, or click to browse'}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="sr-only"
                  onChange={handleUpload}
                  disabled={busy}
                />
              </label>
            </div>
          )}

          {stage.name === 'error' && (
            <p className="text-sm text-destructive">{stage.message}</p>
          )}
        </>
      )}

      {stage.name === 'done' && !isReentry && (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 size={16} />
          Profile imported successfully
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Skip — I'll build my profile manually
        </button>
        {(stage.name === 'done' || isReentry) && (
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(onboarding)/onboarding/_components/steps/Step2Profile.tsx"
git commit -m "feat(onboarding): Step2Profile — LinkedIn / CV import"
```

---

### Task 8: Step3Context — search context form

**Files:**
- Create: `src/app/(onboarding)/onboarding/_components/steps/Step3Context.tsx`

Shows preferredName, currentRole (pre-filled from most recent import), targetRole, and remotePreference. Calls `saveSearchProfile` from `@/modules/search-profile/actions`.

- [ ] **Step 1: Create `src/app/(onboarding)/onboarding/_components/steps/Step3Context.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { saveSearchProfile } from '@/modules/search-profile/actions'
import { toast } from 'sonner'
import type { SearchProfile } from '@/modules/search-profile/schema'

type Props = {
  initialCurrentRole: string
  onNext: () => void
  onSkip: () => void
}

const REMOTE_OPTIONS = [
  { value: 'remote' as const,   label: 'Remote' },
  { value: 'hybrid' as const,   label: 'Hybrid' },
  { value: 'onsite' as const,   label: 'On-site' },
  { value: 'flexible' as const, label: 'Flexible' },
]

export function Step3Context({ initialCurrentRole, onNext, onSkip }: Props) {
  const [preferredName, setPreferredName] = useState('')
  const [currentRole, setCurrentRole] = useState(initialCurrentRole)
  const [targetRole, setTargetRole] = useState('')
  const [remotePreference, setRemotePreference] = useState<SearchProfile['remotePreference']>('')
  const [saving, startSaveTransition] = useTransition()

  function handleSave() {
    startSaveTransition(async () => {
      try {
        const data: SearchProfile = {
          preferredName,
          currentRole,
          roles: targetRole.trim() ? [targetRole.trim()] : [],
          countries: [],
          remotePreference,
          salaryBand: null,
          careerGoals: '',
          pivotContext: '',
          extraContext: '',
        }
        await saveSearchProfile(data)
        toast.success('Search context saved')
        onNext()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save — try again')
      }
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Search context</p>
        <h2 className="text-xl font-bold tracking-tight">What are you looking for?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pre-filled from your profile where we could. This guides job-fit scoring and role suggestions — update anything that's off.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="preferredName">Your name</Label>
          <Input
            id="preferredName"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            placeholder="How should we address you?"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="currentRole">Current role</Label>
          <Input
            id="currentRole"
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value)}
            placeholder="e.g. Senior Product Designer at Acme"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="targetRole">Target role</Label>
          <Input
            id="targetRole"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Head of Product Design"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Work preference</Label>
          <div className="flex flex-wrap gap-2">
            {REMOTE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setRemotePreference(remotePreference === opt.value ? '' : opt.value)
                }
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  remotePreference === opt.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save & continue
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(onboarding)/onboarding/_components/steps/Step3Context.tsx"
git commit -m "feat(onboarding): Step3Context — search context form"
```

---

### Task 9: Step4Start — first action picker

**Files:**
- Create: `src/app/(onboarding)/onboarding/_components/steps/Step4Start.tsx`

All three options fire `completeOnboarding(destination)` and redirect. No skip — every option is a valid completion.

- [ ] **Step 1: Create `src/app/(onboarding)/onboarding/_components/steps/Step4Start.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { completeOnboarding } from '@/modules/onboarding/actions'

type Action = {
  label: string
  description: string
  destination: string
  emoji: string
  primary?: boolean
}

const ACTIONS: Action[] = [
  {
    label: 'Track a job',
    description: 'Paste a job URL to add it to your tracker and run a fit analysis',
    destination: '/dashboard/job-applications',
    emoji: '📋',
    primary: true,
  },
  {
    label: 'Find roles',
    description: 'Browse live job listings matched to your profile via Job Hunter',
    destination: '/dashboard/job-hunt',
    emoji: '🔍',
  },
  {
    label: 'Go to dashboard',
    description: 'Explore the full product and set things up at your own pace',
    destination: '/dashboard',
    emoji: '🏠',
  },
]

export function Step4Start() {
  const [pending, startTransition] = useTransition()

  function handleSelect(destination: string) {
    startTransition(async () => {
      await completeOnboarding(destination)
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-1">Ready</p>
        <h2 className="text-xl font-bold tracking-tight">You're set — where do you want to start?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a starting point. You can always switch between them from the dashboard.
        </p>
      </div>

      <div className="space-y-2">
        {ACTIONS.map((action) => (
          <button
            key={action.destination}
            type="button"
            onClick={() => handleSelect(action.destination)}
            disabled={pending}
            className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${
              action.primary
                ? 'border-primary bg-primary/5 hover:bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <span className="text-2xl">{action.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{action.label}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
            {pending
              ? <Loader2 size={16} className="shrink-0 text-muted-foreground animate-spin" />
              : <span className="shrink-0 text-muted-foreground text-sm">→</span>
            }
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(onboarding)/onboarding/_components/steps/Step4Start.tsx"
git commit -m "feat(onboarding): Step4Start — first action picker"
```

---

### Task 10: Onboarding page + smoke test

**Files:**
- Create: `src/app/(onboarding)/onboarding/page.tsx`

- [ ] **Step 1: Create `src/app/(onboarding)/onboarding/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/session'
import { getLLMConfigStatus } from '@/modules/llm/client'
import { prisma } from '@/lib/db'
import { WizardShell } from './_components/WizardShell'

export default async function Page() {
  const { profile } = await requireProfile()

  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { onboardingCompletedAt: true, onboardingSkippedAt: true },
  })

  if (settings?.onboardingCompletedAt || settings?.onboardingSkippedAt) {
    redirect('/dashboard')
  }

  const [llmStatus, recentExperience, experienceCount] = await Promise.all([
    getLLMConfigStatus(profile.id),
    prisma.experience.findFirst({
      where: { profileId: profile.id },
      orderBy: { startDate: 'desc' },
      select: { role: true },
    }),
    prisma.experience.count({ where: { profileId: profile.id } }),
  ])

  return (
    <WizardShell
      initialLlmStatus={{
        configured: llmStatus.configured,
        provider: llmStatus.provider ?? 'anthropic',
        model: llmStatus.model ?? '',
        availableModels: llmStatus.availableModels,
      }}
      initialProfileImported={experienceCount > 0}
      initialCurrentRole={recentExperience?.role ?? ''}
    />
  )
}
```

- [ ] **Step 2: Full typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 4: Reset onboarding state for the test user**

Open Prisma Studio:
```bash
npm run db:studio
```
Find the `UserSettings` row for `test@example.com`. Set `onboardingCompletedAt` and `onboardingSkippedAt` to `null`. Save.

- [ ] **Step 5: Smoke test the full wizard**

Navigate to `http://localhost:3000/dashboard` — should redirect to `/onboarding`.

Walk each step:

| Check | Expected |
|-------|----------|
| Progress bar fills as steps advance | ✅ |
| Step 1: Provider cards are clickable, radio fills | ✅ |
| Step 1: "Get a key →" link updates per provider | ✅ |
| Step 1: Key input saves, model dropdown unlocks | ✅ |
| Step 1: "Continue →" appears after key + model set | ✅ |
| Step 1: Skip advances to step 2 | ✅ |
| Step 2: LinkedIn / CV tabs switch | ✅ |
| Step 2: PDF upload triggers extraction, then commit | ✅ |
| Step 2: Skip advances to step 3 | ✅ |
| Step 3: `currentRole` pre-filled if profile imported | ✅ |
| Step 3: "Save & continue" saves and advances | ✅ |
| Step 3: Skip advances to step 4 | ✅ |
| Step 4: Each button redirects to correct destination | ✅ |
| After step 4: navigating to `/onboarding` redirects to `/dashboard` | ✅ |
| After step 4: dashboard loads without redirect loop | ✅ |

- [ ] **Step 6: Commit**

```bash
git add "src/app/(onboarding)/onboarding/page.tsx"
git commit -m "feat(onboarding): wire onboarding page server component — closes #273"
```
