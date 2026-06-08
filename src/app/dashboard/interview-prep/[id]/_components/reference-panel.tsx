// src/app/dashboard/interview-prep/[id]/_components/reference-panel.tsx
'use client'
import type { PrepDocumentRow, PrepInterviewerRow } from '@/modules/interview-prep/queries'
type Props = {
  sessionId: string
  activeNoteId: string
  documents: PrepDocumentRow[]
  interviewers: PrepInterviewerRow[]
}
export function ReferencePanel(_props: Props) {
  return <div className="w-80 border-l p-4 text-sm text-muted-foreground">Reference panel coming soon</div>
}
