'use client'

import type { PrepInterviewerRow } from '@/modules/interview-prep/queries'

type Props = {
  sessionId: string
  activeNoteId: string
  interviewers: PrepInterviewerRow[]
}

export function InterviewersTab(_props: Props) {
  return <div className="flex-1 p-4 text-xs text-muted-foreground">Interviewers tab coming soon</div>
}
