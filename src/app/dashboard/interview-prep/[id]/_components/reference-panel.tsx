'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { PrepDocumentRow, PrepInterviewerRow } from '@/modules/interview-prep/queries'
import { DocumentsTab } from './documents-tab'
import { InterviewersTab } from './interviewers-tab'
import { QaTab } from './qa-tab'

type Tab = 'documents' | 'interviewers' | 'qa'

type Props = {
  sessionId: string
  activeNoteId: string
  documents: PrepDocumentRow[]
  interviewers: PrepInterviewerRow[]
}

export function ReferencePanel({ sessionId, activeNoteId, documents, interviewers }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('documents')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'documents', label: 'Documents' },
    { id: 'interviewers', label: 'Interviewers' },
    { id: 'qa', label: 'Q&A' },
  ]

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-hidden border-l bg-muted/10">
      {/* Tab bar */}
      <div className="flex border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 px-2 py-2.5 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'documents' && (
        <DocumentsTab sessionId={sessionId} activeNoteId={activeNoteId} documents={documents} />
      )}
      {activeTab === 'interviewers' && (
        <InterviewersTab sessionId={sessionId} activeNoteId={activeNoteId} interviewers={interviewers} />
      )}
      {activeTab === 'qa' && (
        <QaTab sessionId={sessionId} activeNoteId={activeNoteId} />
      )}
    </div>
  )
}
