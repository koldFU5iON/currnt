# LLM Dynamic Model Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text model ID input in `/dashboard/settings/llm` with a dropdown populated by calling the selected provider's model listing API — validating the key and caching models in one save action.

**Architecture:** A new `src/modules/llm/models.ts` module handles provider-specific HTTP calls and normalises results. Three server actions replace the single `saveLLMSettings`: `saveLLMApiKey` (validates key by fetching models, writes both atomically), `saveLLMModel` (auto-saves on select), and `refreshModels` (re-fetches using stored key). The form is rewritten with three states: no key → saving/fetching spinner → dropdown ready.

**Tech Stack:** Prisma 7 + PostgreSQL, Next.js 16 App Router Server Actions, shadcn/ui (Select, Input, Badge, Button), Tailwind v4, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema/settings.prisma` | Modify | Add `availableModels Json?` to `UserSettings` |
| `prisma/migrations/…` | Create | Migration: `add_available_models_to_user_settings` |
| `src/modules/llm/models.ts` | **Create** | `fetchProviderModels` — per-provider HTTP + normalisation |
| `src/modules/llm/models.test.ts` | **Create** | Unit tests for all three providers + error cases |
| `src/modules/llm/actions.ts` | Modify | Replace `saveLLMSettings` with three focused actions; update `clearLLMApiKey` |
| `src/modules/llm/client.ts` | Modify | Add `availableModels` to `getLLMConfigStatus` return |
| `src/app/dashboard/settings/llm/page.tsx` | Modify | Pass `availableModels` prop to form |
| `src/app/dashboard/settings/llm/_components/llm-settings-form.tsx` | Rewrite | Three-state UX: no key / spinner / dropdown |

---

## Task 1: Schema — add `availableModels` to `UserSettings`

**Files:**
- Modify: `prisma/schema/settings.prisma`

- [ ] **Step 1: Add the field**

Open `prisma/schema/settings.prisma`. After the `llmApiKey` line, add:

```prisma
  availableModels       Json?
```

The full model after the change (relevant lines):

```prisma
model UserSettings {
  id                    String    @id @default(cuid())
  profileId             String    @unique
  llmProvider           String    @default("anthropic")
  llmModel              String    @default("claude-sonnet-4-5-20251001")
  llmApiKey             String?
  llmBaseUrl            String?
  availableModels       Json?
  defaultTemplateId     String?
  ...
```

- [ ] **Step 2: Create and apply the migration**

```bash
npm run db:migrate -- --name add_available_models_to_user_settings
```

Expected: a new timestamped file in `prisma/migrations/` containing `ALTER TABLE "UserSettings" ADD COLUMN "availableModels" JSONB;`. Prisma re-generates the client.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep -i error | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema/settings.prisma prisma/migrations/
git commit -m "feat(llm): add availableModels field to UserSettings"
```

---

## Task 2: `models.ts` — provider fetch + normalisation

**Files:**
- Create: `src/modules/llm/models.ts`
- Create: `src/modules/llm/models.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/llm/models.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchProviderModels } from './models'

beforeEach(() => { vi.clearAllMocks() })

describe('fetchProviderModels — anthropic', () => {
  it('normalises display_name to name', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'claude-opus-4-8', display_name: 'Claude Opus 4' },
          { id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
        ],
      }),
    })
    const result = await fetchProviderModels('anthropic', 'sk-ant-test')
    expect(result).toEqual([
      { id: 'claude-opus-4-8', name: 'Claude Opus 4' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    ])
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-test',
          'anthropic-version': '2023-06-01',
        }),
      }),
    )
  })

  it('throws "Invalid API key" on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(fetchProviderModels('anthropic', 'bad')).rejects.toThrow('Invalid API key')
  })

  it('throws "Couldn\'t reach provider" on 500', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(fetchProviderModels('anthropic', 'sk-ant-test')).rejects.toThrow("Couldn't reach provider")
  })

  it('throws "No models returned" on empty list', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: [] }) })
    await expect(fetchProviderModels('anthropic', 'sk-ant-test')).rejects.toThrow('No models returned')
  })
})

describe('fetchProviderModels — openai', () => {
  it('filters to chat-capable model prefixes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'gpt-4o' },
          { id: 'gpt-3.5-turbo' },
          { id: 'o1-mini' },
          { id: 'o3' },
          { id: 'davinci-002' },      // filtered out
          { id: 'text-embedding-ada-002' }, // filtered out
        ],
      }),
    })
    const result = await fetchProviderModels('openai', 'sk-test')
    expect(result.map(m => m.id)).toEqual(['gpt-4o', 'gpt-3.5-turbo', 'o1-mini', 'o3'])
  })

  it('throws "Invalid API key" on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(fetchProviderModels('openai', 'bad')).rejects.toThrow('Invalid API key')
  })
})

describe('fetchProviderModels — google', () => {
  it('filters to generateContent models and strips models/ prefix', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding-001', displayName: 'Embedding 001', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    })
    const result = await fetchProviderModels('google', 'AI-test')
    expect(result).toEqual([{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }])
  })

  it('throws "Invalid API key" on 403', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
    await expect(fetchProviderModels('google', 'bad')).rejects.toThrow('Invalid API key')
  })
})

describe('fetchProviderModels — unknown provider', () => {
  it('throws for unsupported provider', async () => {
    await expect(fetchProviderModels('llama', 'key')).rejects.toThrow('Unsupported provider')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test -- models 2>&1 | tail -15
```

Expected: `Cannot find module './models'` or similar — the file doesn't exist yet.

- [ ] **Step 3: Create `src/modules/llm/models.ts`**

```ts
export type ProviderModel = { id: string; name: string }

async function fetchAnthropic(apiKey: string): Promise<ProviderModel[]> {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error('Invalid API key — check it and try again.')
    throw new Error("Couldn't reach provider — try again.")
  }
  const data = await res.json() as { data: { id: string; display_name: string }[] }
  const models = data.data.map(m => ({ id: m.id, name: m.display_name }))
  if (models.length === 0)
    throw new Error('No models returned — check your key has the right permissions.')
  return models
}

const OPENAI_CHAT_PREFIXES = ['gpt-', 'o1', 'o3', 'o4', 'chatgpt-']

async function fetchOpenAI(apiKey: string): Promise<ProviderModel[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error('Invalid API key — check it and try again.')
    throw new Error("Couldn't reach provider — try again.")
  }
  const data = await res.json() as { data: { id: string }[] }
  const models = data.data
    .filter(m => OPENAI_CHAT_PREFIXES.some(p => m.id.startsWith(p)))
    .map(m => ({ id: m.id, name: m.id }))
  if (models.length === 0)
    throw new Error('No models returned — check your key has the right permissions.')
  return models
}

async function fetchGoogle(apiKey: string): Promise<ProviderModel[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  )
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error('Invalid API key — check it and try again.')
    throw new Error("Couldn't reach provider — try again.")
  }
  const data = await res.json() as {
    models: { name: string; displayName: string; supportedGenerationMethods: string[] }[]
  }
  const models = data.models
    .filter(m => m.supportedGenerationMethods.includes('generateContent'))
    .map(m => ({ id: m.name.replace('models/', ''), name: m.displayName }))
  if (models.length === 0)
    throw new Error('No models returned — check your key has the right permissions.')
  return models
}

const FETCHERS: Record<string, (apiKey: string) => Promise<ProviderModel[]>> = {
  anthropic: fetchAnthropic,
  openai: fetchOpenAI,
  google: fetchGoogle,
}

export async function fetchProviderModels(
  provider: string,
  apiKey: string,
): Promise<ProviderModel[]> {
  const fetcher = FETCHERS[provider]
  if (!fetcher) throw new Error(`Unsupported provider "${provider}"`)
  return fetcher(apiKey)
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test -- models 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm test 2>&1 | tail -6
```

Expected: all test files pass.

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck 2>&1 | grep -i error | head -10
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/modules/llm/models.ts src/modules/llm/models.test.ts
git commit -m "feat(llm): add fetchProviderModels for Anthropic, OpenAI, Google"
```

---

## Task 3: Update `actions.ts` — three focused actions

**Files:**
- Modify: `src/modules/llm/actions.ts`

Replace the entire file with the following. Note: `saveLLMSettings` is removed — `llm-settings-form.tsx` (rewritten in Task 5) is the only caller and will be updated then.

- [ ] **Step 1: Replace `src/modules/llm/actions.ts`**

```ts
'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { encrypt, decrypt } from '@/lib/encryption'
import { SUPPORTED_PROVIDERS } from './client'
import { fetchProviderModels, type ProviderModel } from './models'

export type SaveLLMApiKeyInput = {
  provider: string
  apiKey: string
}

/**
 * Validates the API key by fetching models from the provider, then writes
 * both the encrypted key and the model list atomically. If the key is
 * invalid or the provider is unreachable, nothing is written.
 */
export async function saveLLMApiKey(
  input: SaveLLMApiKeyInput,
): Promise<{ models: ProviderModel[] }> {
  const { profile } = await requireProfile()

  const provider = input.provider.trim()
  if (!SUPPORTED_PROVIDERS.includes(provider as typeof SUPPORTED_PROVIDERS[number])) {
    throw new Error(`Unsupported provider "${provider}"`)
  }
  if (!input.apiKey.trim()) throw new Error('API key is required')

  const models = await fetchProviderModels(provider, input.apiKey.trim())

  await prisma.userSettings.upsert({
    where: { profileId: profile.id },
    update: {
      llmProvider: provider,
      llmApiKey: encrypt(input.apiKey.trim()),
      availableModels: models,
    },
    create: {
      profileId: profile.id,
      llmProvider: provider,
      llmApiKey: encrypt(input.apiKey.trim()),
      availableModels: models,
    },
  })

  revalidatePath('/dashboard/settings/llm')
  return { models }
}

export async function saveLLMModel(model: string): Promise<void> {
  const { profile } = await requireProfile()
  if (!model.trim()) throw new Error('Model is required')

  await prisma.userSettings.update({
    where: { profileId: profile.id },
    data: { llmModel: model.trim() },
  })

  revalidatePath('/dashboard/settings/llm')
}

export async function refreshModels(): Promise<ProviderModel[]> {
  const { profile } = await requireProfile()

  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { llmProvider: true, llmApiKey: true },
  })

  if (!settings?.llmApiKey) throw new Error('No API key configured.')

  const apiKey = decrypt(settings.llmApiKey)
  if (!apiKey) throw new Error('Stored API key could not be decrypted. Re-enter your key.')

  const models = await fetchProviderModels(settings.llmProvider, apiKey)

  await prisma.userSettings.update({
    where: { profileId: profile.id },
    data: { availableModels: models },
  })

  revalidatePath('/dashboard/settings/llm')
  return models
}

export async function clearLLMApiKey(): Promise<void> {
  const { profile } = await requireProfile()

  await prisma.userSettings.update({
    where: { profileId: profile.id },
    data: { llmApiKey: null, availableModels: Prisma.JsonNull },
  })

  revalidatePath('/dashboard/settings/llm')
}

const WRITING_BRIEF_MAX_LENGTH = 2000

export async function updateWritingBrief(brief: string): Promise<void> {
  const { profile } = await requireProfile()
  if (brief.length > WRITING_BRIEF_MAX_LENGTH) {
    throw new Error(`Writing brief must be ${WRITING_BRIEF_MAX_LENGTH} characters or fewer.`)
  }
  const trimmed = brief.trim() || null
  await prisma.userSettings.upsert({
    where: { profileId: profile.id },
    update: { writingBrief: trimmed },
    create: { profileId: profile.id, writingBrief: trimmed },
  })
  revalidatePath('/dashboard/settings/ai-writing')
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep -i error | head -20
```

Expected: TypeScript will complain that `llm-settings-form.tsx` still imports `saveLLMSettings`. That's expected — it's fixed in Task 5. All other errors should be zero.

- [ ] **Step 3: Run tests**

```bash
npm test 2>&1 | tail -6
```

Expected: all existing tests pass (the client tests don't import actions).

- [ ] **Step 4: Commit**

```bash
git add src/modules/llm/actions.ts
git commit -m "feat(llm): replace saveLLMSettings with saveLLMApiKey, saveLLMModel, refreshModels"
```

---

## Task 4: Update `getLLMConfigStatus` to return `availableModels`

**Files:**
- Modify: `src/modules/llm/client.ts`

- [ ] **Step 1: Update `getLLMConfigStatus` in `src/modules/llm/client.ts`**

Find the `getLLMConfigStatus` function (currently around line 198) and replace it:

```ts
export async function getLLMConfigStatus(profileId: string): Promise<{
  configured: boolean
  provider: string | null
  model: string | null
  availableModels: { id: string; name: string }[] | null
}> {
  const settings = await prisma.userSettings.findUnique({
    where: { profileId },
    select: { llmProvider: true, llmModel: true, llmApiKey: true, availableModels: true },
  })
  return {
    configured: !!settings?.llmApiKey,
    provider: settings?.llmProvider ?? null,
    model: settings?.llmModel ?? null,
    availableModels: (settings?.availableModels as { id: string; name: string }[] | null) ?? null,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep -i error | head -20
```

Expected: still the `saveLLMSettings` import error in `llm-settings-form.tsx` (fixed next task). No new errors from this change.

- [ ] **Step 3: Commit**

```bash
git add src/modules/llm/client.ts
git commit -m "feat(llm): add availableModels to getLLMConfigStatus return"
```

---

## Task 5: Rewrite `LLMSettingsForm` + update `page.tsx`

**Files:**
- Modify: `src/app/dashboard/settings/llm/page.tsx`
- Rewrite: `src/app/dashboard/settings/llm/_components/llm-settings-form.tsx`

Both files change together so the new `availableModels` prop is wired end-to-end in one commit.

- [ ] **Step 1: Update `src/app/dashboard/settings/llm/page.tsx`**

Replace the entire file:

```tsx
import { ContentContainer } from '@/app/components/ContentContainer'
import { requireProfile } from '@/lib/session'
import { getLLMConfigStatus } from '@/modules/llm/client'
import { LLMSettingsForm } from './_components/llm-settings-form'

export default async function Page() {
  const { profile } = await requireProfile()
  const status = await getLLMConfigStatus(profile.id)

  return (
    <ContentContainer
      title="LLM"
      description="Connect your own AI provider — costs land on your account, not the app's."
    >
      <LLMSettingsForm
        initial={{
          provider: status.provider ?? 'anthropic',
          model: status.model ?? '',
          keyConfigured: status.configured,
          availableModels: status.availableModels,
        }}
      />
    </ContentContainer>
  )
}
```

- [ ] **Step 2: Replace `src/app/dashboard/settings/llm/_components/llm-settings-form.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Check, Eye, EyeOff, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveLLMApiKey, saveLLMModel, refreshModels, clearLLMApiKey } from '@/modules/llm/actions'
import { toast } from 'sonner'

type ProviderModel = { id: string; name: string }

type Props = {
  initial: {
    provider: string
    model: string
    keyConfigured: boolean
    availableModels: ProviderModel[] | null
  }
}

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai',    label: 'OpenAI (GPT)' },
  { value: 'google',    label: 'Google (Gemini)' },
] as const

export function LLMSettingsForm({ initial }: Props) {
  const [provider, setProvider] = useState(initial.provider || 'anthropic')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keyConfigured, setKeyConfigured] = useState(initial.keyConfigured)
  const [availableModels, setAvailableModels] = useState<ProviderModel[] | null>(
    initial.availableModels,
  )
  const [selectedModel, setSelectedModel] = useState(initial.model)
  const [modelError, setModelError] = useState<string | null>(null)
  const [saving, startSaveTransition] = useTransition()
  const [refreshing, startRefreshTransition] = useTransition()
  const [modelSaving, startModelSaveTransition] = useTransition()

  function handleProviderChange(next: string) {
    setProvider(next)
    setAvailableModels(null)
    setModelError(null)
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
        toast.success('Key saved and models loaded')
        // Auto-save the first model so there's always a selection
        if (models[0]) await saveLLMModel(models[0].id)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save key')
      }
    })
  }

  function handleModelSelect(model: string) {
    setSelectedModel(model)
    startModelSaveTransition(async () => {
      try {
        await saveLLMModel(model)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save model')
      }
    })
  }

  function handleRefresh() {
    setModelError(null)
    startRefreshTransition(async () => {
      try {
        const models = await refreshModels()
        setAvailableModels(models)
        toast.success('Models refreshed')
      } catch (err) {
        setModelError(
          err instanceof Error ? err.message : "Couldn't load models — Refresh to retry.",
        )
      }
    })
  }

  async function handleClearKey() {
    if (
      !confirm(
        'Remove the saved API key? Any AI features that need it will stop working until you re-enter it.',
      )
    )
      return
    try {
      await clearLLMApiKey()
      setKeyConfigured(false)
      setAvailableModels(null)
      setSelectedModel('')
      toast.success('API key removed')
    } catch {
      toast.error('Failed to remove key')
    }
  }

  const isBusy = saving || refreshing

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Provider */}
      <div className="space-y-2">
        <Label htmlFor="provider">Provider</Label>
        <Select value={provider} onValueChange={handleProviderChange} disabled={isBusy}>
          <SelectTrigger id="provider" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map(p => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* API Key — input group */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="api-key">API Key</Label>
          {keyConfigured && (
            <Badge
              variant="outline"
              className="gap-1 text-xs text-emerald-600 border-emerald-300"
            >
              <Check size={11} />
              Saved
            </Badge>
          )}
        </div>
        <div className="flex rounded-md border overflow-hidden">
          <Input
            id="api-key"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
            placeholder={
              keyConfigured
                ? '•••••••• (leave blank to keep existing)'
                : 'sk-ant-api03-…'
            }
            autoComplete="off"
            disabled={isBusy}
            className="border-0 rounded-none flex-1 font-mono focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <button
            type="button"
            onClick={handleSaveKey}
            disabled={isBusy || !apiKey.trim()}
            aria-label="Save API key"
            className="px-3 border-l bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowKey(v => !v)}
            aria-label={showKey ? 'Hide key' : 'Show key'}
            className="px-3 border-l bg-muted text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Encrypted at rest (AES-256-GCM). Saves key and loads available models.
        </p>
      </div>

      {/* Model */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Model</Label>
          {keyConfigured && availableModels !== null && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <RefreshCw size={11} />
              )}
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
            {saving ? 'Fetching models…' : 'No models loaded'}
          </div>
        ) : (
          <Select
            value={selectedModel}
            onValueChange={handleModelSelect}
            disabled={modelSaving || isBusy}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {modelError && <p className="text-xs text-destructive">{modelError}</p>}
        {availableModels !== null && !modelError && (
          <p className="text-xs text-muted-foreground">
            {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} · saves on
            select
          </p>
        )}
      </div>

      {/* Remove key */}
      {keyConfigured && (
        <div className="border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClearKey}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
          >
            <Trash2 size={14} />
            Remove API key
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck — must be clean**

```bash
npm run typecheck 2>&1 | grep -i error | head -20
```

Expected: zero errors — `saveLLMSettings` import is gone and the new `availableModels` prop is wired end-to-end.

- [ ] **Step 4: Run full test suite**

```bash
npm test 2>&1 | tail -6
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/settings/llm/page.tsx src/app/dashboard/settings/llm/_components/llm-settings-form.tsx
git commit -m "feat(llm): rewrite LLMSettingsForm with dynamic model discovery UX"
```

---

## Verification

- [ ] Start dev server: `npm run dev`
- [ ] Navigate to `/dashboard/settings/llm`
- [ ] Confirm state ①: model field shows "Save a key first", save icon greyed out when key field is empty
- [ ] Enter a valid Anthropic/OpenAI/Google API key → click ✓ save icon
- [ ] Confirm state ②: spinner on save icon, "Fetching models…" in model area
- [ ] Confirm state ③: model dropdown populates with real models from the provider, "N models · saves on select" helper text visible
- [ ] Select a model → confirm it saves immediately (refresh page, model still selected)
- [ ] Click "Refresh" → models reload without clearing the key
- [ ] Change provider → confirm model area resets to "Save a key first"
- [ ] Enter a bad key → confirm toast error, nothing saved
- [ ] Click "Remove API key" → confirm key and models cleared, form returns to state ①
- [ ] `npm run typecheck` — clean
- [ ] `npm test` — all pass
