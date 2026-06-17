'use client'

import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import type { CVSection } from '@/modules/cv/schema'
import type { ATSScoreResult } from '@/modules/cv/ats-score-schema'

const SECTION_LABELS: Record<CVSection['type'], string> = {
  header: 'Header',
  profile: 'Profile',
  competencies: 'Competencies',
  capabilities: 'Capabilities',
  experience: 'Experience',
  education: 'Education',
  certification: 'Certifications',
  skills: 'Skills',
  tools: 'Tools',
  languages: 'Languages',
  custom: 'Custom',
}

const LABEL_COLORS: Record<string, string> = {
  excellent: 'text-emerald-600',
  strong:    'text-green-600',
  good:      'text-amber-600',
  fair:      'text-orange-500',
  poor:      'text-red-500',
}

function getSectionLabel(section: CVSection): string {
  if (section.type === 'experience') return section.data.company || 'Experience'
  if (section.type === 'education') return section.data.institution || 'Education'
  if (section.type === 'certification') return section.data.name || 'Certification'
  if (section.type === 'custom') return section.data.heading || 'Custom'
  return SECTION_LABELS[section.type] ?? section.type
}

type Props = {
  sections: CVSection[]
  onToggleVisibility: (id: string) => void
  atsResult: ATSScoreResult | null
  atsRunning: boolean
  onRunATS: () => void
  onOpenATS: () => void
  onAddCustomSection: (heading: string, subtype: 'text' | 'list') => Promise<void>
  hasJobDescription: boolean
}

export function SectionRail({ sections, onToggleVisibility, atsResult, atsRunning, onRunATS, onOpenATS, onAddCustomSection, hasJobDescription }: Props) {
  const [addingSection, setAddingSection] = useState(false)
  const [newHeading, setNewHeading] = useState('')
  const [newSubtype, setNewSubtype] = useState<'text' | 'list'>('text')

  async function handleSubmit() {
    if (!newHeading.trim()) return
    try {
      await onAddCustomSection(newHeading.trim(), newSubtype)
      setNewHeading('')
      setNewSubtype('text')
      setAddingSection(false)
    } catch {
      // error already toasted by the caller (CvEditor.handleAddCustomSection)
    }
  }

  return (
    <div className="hidden md:block w-48 shrink-0 overflow-y-auto border-l border-border bg-muted/20 p-4 print:hidden">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Sections
      </p>
      <div className="flex flex-col gap-1">
        {sections.map(section => (
          <div
            key={section.id}
            className="group flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted"
          >
            <span className={section.visible ? 'text-foreground' : 'text-muted-foreground line-through'}>
              {getSectionLabel(section)}
            </span>
            <button
              onClick={() => onToggleVisibility(section.id)}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              title={section.visible ? 'Hide' : 'Show'}
            >
              {section.visible
                ? <EyeOff className="size-3 text-muted-foreground" />
                : <Eye className="size-3 text-muted-foreground" />
              }
            </button>
          </div>
        ))}
      </div>

      {/* Add custom section */}
      <div className="mt-3">
        {addingSection ? (
          <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
            <input
              autoFocus
              value={newHeading}
              onChange={e => setNewHeading(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') setAddingSection(false) }}
              placeholder="Section name"
              className="w-full rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-1">
              {(['text', 'list'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewSubtype(t)}
                  className={`flex-1 rounded px-2 py-0.5 text-xs capitalize transition-colors ${newSubtype === t ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={handleSubmit} className="flex-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90">
                Add
              </button>
              <button type="button" onClick={() => setAddingSection(false)} className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
                ✕
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingSection(true)}
            className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
          >
            + Add section
          </button>
        )}
      </div>

      {/* ATS compact widget */}
      <div className="mt-6 rounded-md border border-border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">ATS Score</p>
        {atsResult ? (
          <button onClick={onOpenATS} className="w-full text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold tabular-nums">{atsResult.breakdown.finalScore}</span>
              <span className={`text-xs font-medium capitalize ${LABEL_COLORS[atsResult.breakdown.label] ?? ''}`}>
                {atsResult.breakdown.label}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground/70 transition-all"
                style={{ width: `${atsResult.breakdown.finalScore}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">View full report →</p>
          </button>
        ) : (
          <button
            type="button"
            onClick={onRunATS}
            disabled={atsRunning || !hasJobDescription}
            title={!hasJobDescription ? 'Attach a job description to enable ATS scoring' : undefined}
            className="flex w-full items-center justify-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {atsRunning
              ? <><Loader2 className="size-3 animate-spin" />Checking…</>
              : 'Run analysis →'}
          </button>
        )}
      </div>
    </div>
  )
}
