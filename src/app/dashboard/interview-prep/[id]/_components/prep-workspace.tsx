// src/app/dashboard/interview-prep/[id]/_components/prep-workspace.tsx
'use client'

import { useState } from 'react'
import type { PrepSessionWithChildren } from '@/modules/interview-prep/queries'
import { NotesPanel } from './notes-panel'
import { ReferencePanel } from './reference-panel'

type Props = { session: PrepSessionWithChildren }

export function PrepWorkspace({ session }: Props) {
  const [activeNoteId, setActiveNoteId] = useState<string>(
    session.notes[0]?.id ?? ''
  )

  const activeNote = session.notes.find(n => n.id === activeNoteId) ?? session.notes[0]

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
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
  )
}
