// src/app/dashboard/interview-prep/[id]/_components/notes-panel.tsx
'use client'
import type { PrepNoteRow } from '@/modules/interview-prep/queries'
type Props = {
  sessionId: string
  notes: PrepNoteRow[]
  activeNoteId: string
  onNoteChange: (id: string) => void
  activeNote: PrepNoteRow | undefined
}
export function NotesPanel(_props: Props) {
  return <div className="flex-1 border-r p-4 text-sm text-muted-foreground">Notes panel coming soon</div>
}
