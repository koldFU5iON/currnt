'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { updateExperienceDetails } from '@/modules/profile/actions'
import type { ExperienceWithActivities } from '@/app/types/profile'
import type { SaveState } from './NoteEditor'

type Props = {
  experience: ExperienceWithActivities
  saveState: SaveState
  projectName?: string
  onBack?: () => void
}

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })

function getDetailsFields(exp: ExperienceWithActivities) {
  return {
    company: exp.company,
    role: exp.role,
    location: exp.location ?? undefined,
    remote: exp.remote,
    startDate: new Date(exp.startDate),
    endDate: exp.endDate ? new Date(exp.endDate) : undefined,
  }
}

export function ExperienceFrontmatter({ experience, saveState, projectName, onBack }: Props) {
  const router = useRouter()

  if (projectName !== undefined) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-3 py-2 text-xs">
        <button
          type="button"
          onClick={onBack}
          className="text-primary hover:underline"
        >
          ← {experience.company}
        </button>
        <span className="text-muted-foreground">›</span>
        <span className="font-semibold">{projectName}</span>
        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
          Project
        </span>
        <div className="ml-auto">
          <SaveIndicator state={saveState} />
        </div>
      </div>
    )
  }

  async function saveField(field: keyof ReturnType<typeof getDetailsFields>, value: string | boolean) {
    const current = getDetailsFields(experience)
    await updateExperienceDetails(experience.id, { ...current, [field]: value })
    router.refresh()
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/30 px-3 py-2 text-xs">
      <InlineField
        label="Company"
        value={experience.company}
        onSave={v => saveField('company', v)}
      />
      <InlineField
        label="Role"
        value={experience.role}
        onSave={v => saveField('role', v)}
      />
      <span className="text-muted-foreground">
        {fmtDate(experience.startDate)} –{' '}
        {experience.endDate ? fmtDate(experience.endDate) : 'Present'}
      </span>
      {experience.location && (
        <span className="text-muted-foreground">
          {experience.location}
          {experience.remote && ' · Remote'}
        </span>
      )}
      <div className="ml-auto">
        <SaveIndicator state={saveState} />
      </div>
    </div>
  )
}

function InlineField({
  label,
  value,
  onSave,
}: {
  label: string
  value: string
  onSave: (v: string) => Promise<unknown>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  async function handleBlur() {
    setEditing(false)
    if (draft.trim() && draft !== value) await onSave(draft.trim())
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="border-b border-primary bg-transparent text-xs font-semibold outline-none"
        />
      </div>
    )
  }

  return (
    <div
      className="group flex cursor-pointer flex-col gap-0.5"
      onClick={() => setEditing(true)}
    >
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="border-b border-dashed border-muted-foreground/40 font-semibold transition-colors group-hover:border-foreground/60">
        {draft}
      </span>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  return (
    <span
      className={cn(
        'text-[10px]',
        state === 'saving' && 'text-muted-foreground',
        state === 'saved' && 'text-emerald-600 dark:text-emerald-400',
        state === 'error' && 'text-destructive',
      )}
    >
      {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save failed'}
    </span>
  )
}
