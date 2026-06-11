'use client'

import { useState } from 'react'
import { PanelRight, X } from 'lucide-react'
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
  const [mobileOpen, setMobileOpen] = useState(false)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'documents', label: 'Documents' },
    { id: 'interviewers', label: 'Interviewers' },
    { id: 'qa', label: 'Q&A' },
  ]

  const panel = (
    <div className="flex h-full flex-col overflow-hidden bg-muted/10">
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
        {/* Close button — mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="sm:hidden px-3 py-2.5 text-muted-foreground hover:text-foreground"
          aria-label="Close reference panel"
        >
          <X className="size-4" />
        </button>
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

  return (
    <>
      {/* Mobile toggle button — visible only when panel is closed */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="sm:hidden absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-full border bg-background px-3 py-2 text-xs font-medium shadow-md"
          aria-label="Open reference panel"
        >
          <PanelRight className="size-3.5" />
          Resources
        </button>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sm:hidden absolute inset-0 z-20 border-l bg-background">
          {panel}
        </div>
      )}

      {/* Desktop: fixed right panel */}
      <div className="hidden sm:flex w-80 shrink-0 flex-col overflow-hidden border-l">
        {panel}
      </div>
    </>
  )
}
