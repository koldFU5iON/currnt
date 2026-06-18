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
