// src/app/dashboard/interview-prep/[id]/_components/prep-workspace.tsx
'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PrepSessionWithChildren } from '@/modules/interview-prep/queries'
import { usePageContext, useWorkspaceContext } from '@/lib/context/page-context'
import { NotesPanel } from './notes-panel'
import { ReferencePanel } from './reference-panel'

type Props = { session: PrepSessionWithChildren }

export function PrepWorkspace({ session }: Props) {
  const [activeNoteId, setActiveNoteId] = useState<string>(
    session.notes[0]?.id ?? ''
  )

  const activeNote = session.notes.find(n => n.id === activeNoteId) ?? session.notes[0]

  const { openPanel } = usePageContext()
  useWorkspaceContext({
    type: 'interview_prep',
    sessionId: session.id,
    company: session.company ?? undefined,
    role: session.jobTitle ?? undefined,
  })

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-end border-b bg-background px-4 py-1.5 print:hidden">
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={openPanel}>
          <Sparkles className="size-3.5" />
          Ask coach
        </Button>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <NotesPanel
          sessionId={session.id}
          notes={session.notes}
          activeNoteId={activeNoteId}
          onNoteChange={setActiveNoteId}
          activeNote={activeNote}
        />
        <ReferencePanel
          sessionId={session.id}
          activeNoteId={activeNoteId}
          documents={session.documents}
          interviewers={session.interviewers}
        />
      </div>
    </div>
  )
}
