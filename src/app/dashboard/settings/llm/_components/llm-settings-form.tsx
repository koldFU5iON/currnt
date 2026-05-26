'use client'

import { useState, useTransition } from 'react'
import { Check, Eye, EyeOff, Loader2, Trash2 } from 'lucide-react'
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
import { saveLLMSettings, clearLLMApiKey } from '@/modules/llm/actions'
import { toast } from 'sonner'

type Props = {
  initial: {
    provider: string
    model: string
    keyConfigured: boolean
  }
}

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)', sampleModel: 'claude-sonnet-4-6' },
  { value: 'openai',    label: 'OpenAI (GPT)',       sampleModel: 'gpt-5' },
  { value: 'google',    label: 'Google (Gemini)',    sampleModel: 'gemini-2.5-pro' },
] as const

function sampleModelFor(provider: string): string {
  return PROVIDERS.find(p => p.value === provider)?.sampleModel ?? ''
}

export function LLMSettingsForm({ initial }: Props) {
  const [provider, setProvider] = useState(initial.provider || 'anthropic')
  const [model, setModel] = useState(initial.model || sampleModelFor(initial.provider || 'anthropic'))
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keyConfigured, setKeyConfigured] = useState(initial.keyConfigured)
  const [testing, setTesting] = useState(false)
  const [saving, startSaveTransition] = useTransition()

  function handleProviderChange(next: string | null) {
    if (!next) return
    setProvider(next)
    // If the user hasn't typed a custom model, switch the model to the new provider's sample.
    if (!model || PROVIDERS.some(p => p.sampleModel === model)) {
      setModel(sampleModelFor(next))
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    startSaveTransition(async () => {
      try {
        await saveLLMSettings({ provider, model: model.trim(), apiKey: apiKey || undefined })
        toast.success('Settings saved')
        if (apiKey) {
          setKeyConfigured(true)
          setApiKey('') // form clears the field so it can't be accidentally exfiltrated
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  async function handleClearKey() {
    if (!confirm('Remove the saved API key? Any AI features that need it will stop working until you re-enter it.')) return
    try {
      await clearLLMApiKey()
      setKeyConfigured(false)
      toast.success('API key removed')
    } catch {
      toast.error('Failed to remove key')
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const res = await fetch('/api/llm/ping', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        toast.success(`OK — ${data.provider}/${data.model} replied in ${data.latencyMs}ms`)
      } else {
        toast.error(`${data.error}: ${data.message}`)
      }
    } catch {
      toast.error('Test failed — server didn\'t respond')
    } finally {
      setTesting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="provider">Provider</Label>
        <Select value={provider} onValueChange={handleProviderChange}>
          <SelectTrigger id="provider" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <Input
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={sampleModelFor(provider)}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          The exact model ID from your provider. Examples: <code className="font-mono">{sampleModelFor(provider)}</code>.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="api-key">API key</Label>
          {keyConfigured && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Check size={11} />
              Saved
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="api-key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={keyConfigured ? '••••••• (leave blank to keep existing)' : 'sk-ant-... / sk-... / AI...'}
              autoComplete="off"
              className="pr-9 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              aria-label={showKey ? 'Hide key' : 'Show key'}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {keyConfigured && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClearKey}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
              aria-label="Remove saved API key"
            >
              <Trash2 size={14} />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Stored encrypted (AES-256-GCM) at rest. Never logged, never sent to the client after save.
          Get a key from your provider&apos;s dashboard.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleTest}
          disabled={testing || !keyConfigured}
          className="gap-1.5"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : null}
          {testing ? 'Testing…' : 'Test connection'}
        </Button>
        {!keyConfigured && (
          <p className="text-xs text-muted-foreground">
            Save a key first to test.
          </p>
        )}
      </div>
    </form>
  )
}
