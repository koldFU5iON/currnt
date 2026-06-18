'use client'

import { useRef, useState, useTransition } from 'react'
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { extractProfileFromPdf } from '@/modules/profile-import/extract'
import { commitImportedProfile } from '@/modules/profile-import/commit'

type Props = {
  initialProfileImported: boolean
  onNext: () => void
  onSkip: () => void
}

type ImportState =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'success'; summary: string }
  | { status: 'error'; message: string }

type ImportMode = 'linkedin' | 'cv'

export function Step2Profile({ initialProfileImported, onNext, onSkip }: Props) {
  const [mode, setMode] = useState<ImportMode>('linkedin')
  const [showDropZones, setShowDropZones] = useState(!initialProfileImported)
  const [importState, setImportState] = useState<ImportState>({ status: 'idle' })
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [, startTransition] = useTransition()

  function handleFile(file: File) {
    if (!file) return
    setImportState({ status: 'processing' })

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('file', file)

        const result = await extractProfileFromPdf(formData)
        if (!result.ok) {
          setImportState({ status: 'error', message: result.message ?? 'Import failed' })
          return
        }

        const commitResult = await commitImportedProfile(result.data)
        const roleCount = commitResult.created.experiences
        const skillCount = commitResult.created.skills
        setImportState({
          status: 'success',
          summary: `Imported ${roleCount} role${roleCount !== 1 ? 's' : ''} and ${skillCount} skill${skillCount !== 1 ? 's' : ''}`,
        })
        setShowDropZones(false)
      } catch (err) {
        setImportState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Something went wrong',
        })
      }
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const isProcessing = importState.status === 'processing'

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
          Build your profile
        </p>
        <h2 className="text-xl font-bold tracking-tight">Let&apos;s build your profile</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Import your experience so Currnt can score job fit and tailor your applications. LinkedIn gives the best results.
        </p>
      </div>

      {/* Re-entry summary card */}
      {!showDropZones && importState.status !== 'success' && (
        <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            Profile already imported — your experience is loaded.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onNext}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setShowDropZones(true)}
              className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
            >
              Re-import
            </button>
          </div>
        </div>
      )}

      {/* Import success card */}
      {importState.status === 'success' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
            <CheckCircle2 size={16} className="shrink-0" />
            {importState.summary}
          </div>
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Drop zones */}
      {showDropZones && importState.status !== 'success' && (
        <div className="space-y-3">
          {/* Mode tabs */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            {(['linkedin', 'cv'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 py-2 font-medium transition-colors',
                  mode === m ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                )}
              >
                {m === 'linkedin' ? 'LinkedIn (recommended)' : 'Upload a CV'}
              </button>
            ))}
          </div>

          {/* Instructions */}
          {mode === 'linkedin' ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Go to LinkedIn → Me → Settings → Data Privacy → Get a copy of your data → select <strong>Profile</strong>. Upload the zip file below.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Upload your CV as a PDF. Quality varies — we&apos;ll extract what we can.
            </p>
          )}

          {/* Error message */}
          {importState.status === 'error' && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>{importState.message} — try uploading again or skip to build your profile manually.</span>
            </div>
          )}

          {/* Drop zone */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            disabled={isProcessing}
            className={cn(
              'w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
              isProcessing && 'opacity-60 cursor-not-allowed',
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 size={22} className="animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Processing…</span>
              </>
            ) : (
              <>
                <Upload size={22} className="text-muted-foreground" />
                <span className="text-sm font-medium">
                  {mode === 'linkedin' ? 'Drop your LinkedIn zip here' : 'Drop your CV PDF here'}
                </span>
                <span className="text-xs text-muted-foreground">or click to browse</span>
              </>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept={mode === 'linkedin' ? '.zip' : '.pdf'}
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* Skip */}
      {!isProcessing && importState.status !== 'success' && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Skip — I&apos;ll build my profile manually
          </button>
        </div>
      )}
    </div>
  )
}
