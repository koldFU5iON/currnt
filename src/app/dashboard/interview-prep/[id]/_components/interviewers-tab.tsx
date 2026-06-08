'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import type { PrepInterviewerRow } from '@/modules/interview-prep/queries'
import { addInterviewer, updateInterviewer, deleteInterviewer } from '@/modules/interview-prep/actions'

type Props = {
  sessionId: string
  activeNoteId: string
  interviewers: PrepInterviewerRow[]
}

export function InterviewersTab({ sessionId, activeNoteId, interviewers }: Props) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [aiError, setAiError] = useState<string | null>(null)

  function handleAdd() {
    if (!newName.trim()) return
    startTransition(async () => {
      await addInterviewer(sessionId, { name: newName.trim(), role: newRole.trim() || undefined })
      setNewName('')
      setNewRole('')
      setShowAddForm(false)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteInterviewer(id) })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {interviewers.length === 0 && !showAddForm && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Add interviewers to get AI-powered insights about who you'll be speaking with.
          </p>
        )}

        {interviewers.map(interviewer => (
          <InterviewerCard
            key={interviewer.id}
            interviewer={interviewer}
            expanded={expandedId === interviewer.id}
            onExpand={() => setExpandedId(v => v === interviewer.id ? null : interviewer.id)}
            onDelete={() => handleDelete(interviewer.id)}
            onUpdate={(field, value) => {
              startTransition(async () => { await updateInterviewer(interviewer.id, { [field]: value }) })
            }}
            activeNoteId={activeNoteId}
            onAnalyseError={setAiError}
            isPending={isPending}
          />
        ))}

        {aiError && <p className="text-[10px] text-destructive">{aiError}</p>}

        {showAddForm && (
          <div className="rounded-lg border p-3 space-y-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Interviewer name"
              className="w-full rounded border bg-background px-2 py-1 text-xs outline-none"
              autoFocus
            />
            <input
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              placeholder="Role / title (optional)"
              className="w-full rounded border bg-background px-2 py-1 text-xs outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={isPending || !newName.trim()}
                className="rounded bg-primary px-3 py-1 text-[10px] text-primary-foreground disabled:opacity-50"
              >
                Add
              </button>
              <button onClick={() => setShowAddForm(false)} className="rounded border px-3 py-1 text-[10px] hover:bg-accent">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-3">
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full rounded border px-3 py-1.5 text-xs hover:bg-accent"
        >
          + Add interviewer
        </button>
      </div>
    </div>
  )
}

type CardProps = {
  interviewer: PrepInterviewerRow
  expanded: boolean
  onExpand: () => void
  onDelete: () => void
  onUpdate: (field: 'linkedInText' | 'notes', value: string) => void
  activeNoteId: string
  onAnalyseError: (msg: string) => void
  isPending: boolean
}

function InterviewerCard({ interviewer, expanded, onExpand, onDelete, onUpdate, activeNoteId, onAnalyseError, isPending }: CardProps) {
  const [linkedIn, setLinkedIn] = useState(interviewer.linkedInText ?? '')
  const [notes, setNotes] = useState(interviewer.notes ?? '')

  return (
    <div className={cn('rounded-lg border p-3', interviewer.aiAnalysedAt && 'border-l-2 border-l-primary')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">{interviewer.name}</p>
          {interviewer.role && <p className="text-[10px] text-muted-foreground">{interviewer.role}</p>}
          {interviewer.aiAnalysedAt && <p className="text-[10px] text-primary">✦ Analysed</p>}
        </div>
        <div className="flex gap-1">
          <button onClick={onExpand} className="rounded border px-2 py-0.5 text-[10px] hover:bg-accent">
            {expanded ? 'Close' : 'Edit'}
          </button>
          <button onClick={onDelete} disabled={isPending} className="rounded border px-2 py-0.5 text-[10px] text-destructive hover:bg-accent disabled:opacity-40">
            ✕
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          <div>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">LinkedIn profile text</p>
            <textarea
              value={linkedIn}
              onChange={e => setLinkedIn(e.target.value)}
              onBlur={() => onUpdate('linkedInText', linkedIn)}
              placeholder="Paste the interviewer's LinkedIn profile text here…"
              rows={5}
              className="w-full resize-none rounded border bg-background px-2 py-1 text-xs outline-none"
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => onUpdate('notes', notes)}
              placeholder="Any other notes about this interviewer…"
              rows={3}
              className="w-full resize-none rounded border bg-background px-2 py-1 text-xs outline-none"
            />
          </div>

          <AnalyseInterviewerButton
            interviewerId={interviewer.id}
            activeNoteId={activeNoteId}
            onError={onAnalyseError}
          />

          {Boolean(interviewer.aiAnalysis) && (
            <div className="rounded border-l-2 border-l-primary bg-muted/20 p-2">
              <p className="mb-1 text-[10px] font-semibold text-primary">✦ AI Profile Analysis</p>
              <div className="whitespace-pre-wrap text-[11px] leading-relaxed">
                {String((interviewer.aiAnalysis as { content?: string })?.content ?? '')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AnalyseInterviewerButton({
  interviewerId, activeNoteId, onError,
}: { interviewerId: string; activeNoteId: string; onError: (msg: string) => void }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      onClick={() => {
        startTransition(async () => {
          const { analyseInterviewer } = await import('@/modules/interview-prep/ai-actions')
          const result = await analyseInterviewer(interviewerId, activeNoteId)
          if (!result.ok) onError(result.message)
        })
      }}
      disabled={isPending || !activeNoteId}
      className="w-full rounded border border-primary/40 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-40"
    >
      {isPending ? 'Analysing…' : '✦ Analyse interviewer profile'}
    </button>
  )
}
