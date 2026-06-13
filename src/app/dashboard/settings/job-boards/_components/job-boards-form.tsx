'use client'

import { useState, useTransition } from 'react'
import { Check, Eye, EyeOff, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { saveJobBoardApiKey, clearJobBoardApiKey } from '../_actions'

type Props = {
  adzunaConfigured: boolean
  jSearchConfigured: boolean
}

export function JobBoardsForm({ adzunaConfigured, jSearchConfigured }: Props) {
  const [jSearchKey, setJSearchKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keyConfigured, setKeyConfigured] = useState(jSearchConfigured)
  const [saving, startSave] = useTransition()
  const [clearing, startClear] = useTransition()

  function handleSave() {
    if (!jSearchKey.trim()) return
    startSave(async () => {
      try {
        await saveJobBoardApiKey('jsearch', jSearchKey.trim())
        setKeyConfigured(true)
        setJSearchKey('')
        toast.success('JSearch API key saved')
      } catch {
        toast.error('Failed to save key')
      }
    })
  }

  function handleClear() {
    if (!confirm('Remove the JSearch API key? Board scanning via LinkedIn/Indeed/Glassdoor will stop.')) return
    startClear(async () => {
      try {
        await clearJobBoardApiKey('jsearch')
        setKeyConfigured(false)
        toast.success('API key removed')
      } catch {
        toast.error('Failed to remove key')
      }
    })
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Adzuna */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Adzuna</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Broad global coverage — aggregates IE, UK, FR, US job boards. App-level key, no action required.
            </p>
          </div>
          {adzunaConfigured ? (
            <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-300">
              <Check size={11} /> Configured
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Not available
            </Badge>
          )}
        </div>
      </div>

      <div className="border-t" />

      {/* JSearch */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">JSearch (RapidAPI)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Searches LinkedIn, Indeed, and Glassdoor globally. Requires your own RapidAPI key — free tier available.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="jsearch-key">RapidAPI Key</Label>
            {keyConfigured && (
              <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-300">
                <Check size={11} /> Saved
              </Badge>
            )}
          </div>
          <div className="flex rounded-md border overflow-hidden">
            <Input
              id="jsearch-key"
              type={showKey ? 'text' : 'password'}
              value={jSearchKey}
              onChange={(e) => setJSearchKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={keyConfigured ? '•••••••• (leave blank to keep existing)' : 'Your RapidAPI key…'}
              autoComplete="off"
              disabled={saving}
              className="border-0 rounded-none flex-1 font-mono focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !jSearchKey.trim()}
              aria-label="Save key"
              className="px-3 border-l bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
          <p className="text-xs text-muted-foreground">Encrypted at rest (AES-256-GCM).</p>
        </div>

        {keyConfigured && (
          <div className="border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              disabled={clearing}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
            >
              <Trash2 size={14} />
              Remove API key
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
