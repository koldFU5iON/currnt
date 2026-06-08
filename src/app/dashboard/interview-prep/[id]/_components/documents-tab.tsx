'use client'

import { useState, useTransition, useRef } from 'react'
import type { PrepDocumentRow } from '@/modules/interview-prep/queries'
import { addDocument, deleteDocument } from '@/modules/interview-prep/actions'
import { cn } from '@/lib/utils'

type Props = {
  sessionId: string
  activeNoteId: string
  documents: PrepDocumentRow[]
}

export function DocumentsTab({ sessionId, activeNoteId: _activeNoteId, documents }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteName, setPasteName] = useState('')
  const [pasteContent, setPasteContent] = useState('')

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)

    if (file.type === 'application/pdf') {
      // Dynamic import to avoid bundle size impact
      const { extractPdfText } = await import('@/modules/profile-import/pdf')
      const bytes = new Uint8Array(await file.arrayBuffer())
      const text = await extractPdfText(bytes)
      if (!text.trim()) {
        setUploadError('This PDF appears to be image-only — paste the text manually instead.')
        if (fileRef.current) fileRef.current.value = ''
        return
      }
      startTransition(async () => {
        await addDocument(sessionId, { name: file.name, docType: 'other', content: text })
      })
    } else if (file.type === 'text/plain') {
      const text = await file.text()
      startTransition(async () => {
        await addDocument(sessionId, { name: file.name, docType: 'other', content: text })
      })
    } else {
      setUploadError('Supported formats: PDF, TXT. For Word docs, copy and paste the text.')
    }

    if (fileRef.current) fileRef.current.value = ''
  }

  async function handlePasteSubmit() {
    if (!pasteName.trim() || !pasteContent.trim()) return
    startTransition(async () => {
      await addDocument(sessionId, { name: pasteName.trim(), docType: 'other', content: pasteContent.trim() })
      setPasteName('')
      setPasteContent('')
      setPasteMode(false)
    })
  }

  function handleDelete(docId: string) {
    startTransition(async () => { await deleteDocument(docId) })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.length === 0 && !pasteMode && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No documents yet. Upload an interview pack, company values doc, or any relevant material.
          </p>
        )}

        {documents.map(doc => (
          <div key={doc.id} className={cn('rounded-lg border p-3', doc.aiAnalysedAt && 'border-l-2 border-l-primary')}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{doc.name}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {doc.docType !== 'other' ? doc.docType : ''}
                  {doc.aiAnalysedAt ? ' · ✦ Analysed' : ''}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setExpandedId(v => v === doc.id ? null : doc.id)}
                  className="rounded px-2 py-0.5 text-[10px] border hover:bg-accent"
                >
                  {expandedId === doc.id ? 'Hide' : 'View'}
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={isPending}
                  className="rounded px-2 py-0.5 text-[10px] text-destructive border hover:bg-accent disabled:opacity-40"
                >
                  ✕
                </button>
              </div>
            </div>

            {expandedId === doc.id && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap">
                {doc.content}
              </div>
            )}

            {expandedId === doc.id && Boolean(doc.aiAnalysis) && (
              <div className="mt-2 rounded border-l-2 border-l-primary bg-muted/20 p-2 text-[11px] leading-relaxed">
                <p className="mb-1 text-[10px] font-semibold text-primary">✦ AI Insights</p>
                <div className="whitespace-pre-wrap">
                  {String((doc.aiAnalysis as Record<string, unknown>)?.content ?? '')}
                </div>
              </div>
            )}
          </div>
        ))}

        {pasteMode && (
          <div className="rounded-lg border p-3 space-y-2">
            <input
              value={pasteName}
              onChange={e => setPasteName(e.target.value)}
              placeholder="Document name"
              className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1"
            />
            <textarea
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
              placeholder="Paste document text here…"
              rows={6}
              className="w-full resize-none rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1"
            />
            <div className="flex gap-2">
              <button
                onClick={handlePasteSubmit}
                disabled={isPending || !pasteName.trim() || !pasteContent.trim()}
                className="rounded bg-primary px-3 py-1 text-[10px] text-primary-foreground disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => setPasteMode(false)} className="rounded px-3 py-1 text-[10px] border hover:bg-accent">
                Cancel
              </button>
            </div>
          </div>
        )}

        {uploadError && (
          <p className="text-[10px] text-destructive">{uploadError}</p>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t p-3 space-y-2">
        <div className="flex gap-2">
          <label className="flex-1 cursor-pointer rounded border px-3 py-1.5 text-center text-xs hover:bg-accent">
            Upload PDF / TXT
            <input ref={fileRef} type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            onClick={() => setPasteMode(v => !v)}
            className="flex-1 rounded border px-3 py-1.5 text-xs hover:bg-accent"
          >
            Paste text
          </button>
        </div>
      </div>
    </div>
  )
}
