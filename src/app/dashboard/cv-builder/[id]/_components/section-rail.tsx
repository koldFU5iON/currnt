'use client'

import { Eye, EyeOff } from 'lucide-react'
import type { CVSection } from '@/modules/cv/schema'

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
}

type Props = {
  sections: CVSection[]
  onToggleVisibility: (id: string) => void
}

export function SectionRail({ sections, onToggleVisibility }: Props) {
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
              {SECTION_LABELS[section.type] ?? section.type}
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

      {/* ATS stub — Phase 2 */}
      <div className="mt-6 rounded-md border border-dashed border-border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">ATS Score</p>
        <div className="mb-2 h-1.5 w-full rounded-full bg-muted" />
        <button
          disabled
          className="w-full rounded px-2 py-1 text-xs text-muted-foreground opacity-50"
          title="Coming soon"
        >
          Run analysis →
        </button>
      </div>
    </div>
  )
}
