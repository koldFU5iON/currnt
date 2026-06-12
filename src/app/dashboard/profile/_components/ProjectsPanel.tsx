'use client'

import { useState } from 'react'
import { Layers, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createProject, deleteProject } from '@/modules/profile/actions'
import type { Project } from '@/app/types/profile'
import { cn } from '@/lib/utils'

type Props = {
  experienceId: string
  initialProjects: Project[]
  selectedProjectId: string | null
  onSelect: (projectId: string) => void
  onProjectCreated: (project: Project) => void
}

export function ProjectsPanel({
  experienceId,
  initialProjects,
  selectedProjectId,
  onSelect,
  onProjectCreated,
}: Props) {
  const [projects, setProjects] = useState(initialProjects)
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleCreate() {
    if (!newName.trim()) return
    try {
      const created = await createProject({
        name: newName.trim(),
        description: '',
        experienceId,
      })
      const project: Project = {
        ...created,
        highlights: JSON.parse(created.highlights ?? '[]') as string[],
        tags: JSON.parse(created.tags ?? '[]') as string[],
      }
      setProjects(prev => [...prev, project])
      setAddingNew(false)
      setNewName('')
      onProjectCreated(project)
      onSelect(created.id)
    } catch {
      toast.error('Failed to create project. Please try again.')
    }
  }

  async function handleDelete(id: string) {
    const prev = projects
    setProjects(prev => prev.filter(item => item.id !== id))
    try { await deleteProject(id) } catch { setProjects(prev) }
  }

  const panel = (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b px-2 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Projects
        </span>
        <div className="flex items-center gap-1">
          {/* Close button — mobile only */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground md:hidden"
            aria-label="Close projects panel"
          >
            <X size={12} />
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setAddingNew(true)}
            aria-label="Add project"
            disabled={addingNew}
          >
            <Plus size={11} />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {projects.map(project => (
          <div
            key={project.id}
            role="button"
            tabIndex={0}
            aria-label={`Select project ${project.name}`}
            className={cn(
              'group relative cursor-pointer rounded px-2 py-1.5 text-xs leading-snug transition-colors',
              selectedProjectId === project.id
                ? 'border border-emerald-300 bg-emerald-50 font-semibold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'border border-transparent text-muted-foreground hover:bg-muted',
            )}
            onClick={() => onSelect(project.id)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(project.id)
              }
            }}
          >
            <span className="block break-words pr-5">{project.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
              onClick={e => { e.stopPropagation(); void handleDelete(project.id) }}
              aria-label={`Delete ${project.name}`}
            >
              <Trash2 size={9} />
            </Button>
          </div>
        ))}

        {addingNew && (
          <div className="space-y-1.5">
            <Input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void handleCreate()
                if (e.key === 'Escape') { setAddingNew(false); setNewName('') }
              }}
              placeholder="Project name"
              className="h-7 px-2 text-xs"
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 flex-1 text-[10px]" onClick={() => void handleCreate()}>
                Add
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-6 flex-1 text-[10px]"
                onClick={() => { setAddingNew(false); setNewName('') }}
              >
                ✕
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile trigger — floating pill, hidden on desktop */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-full border bg-background px-3 py-2 text-xs font-medium shadow-md transition-colors hover:bg-accent md:hidden"
          aria-label="Open projects panel"
        >
          <Layers size={13} />
          Projects
        </button>
      )}

      {/* Mobile overlay — full-height panel over the editor */}
      {mobileOpen && (
        <div className="absolute inset-0 z-20 border-l bg-background md:hidden">
          {panel}
        </div>
      )}

      {/* Desktop panel — always in flex flow */}
      <div className="hidden w-[220px] shrink-0 flex-col border-l md:flex">
        {panel}
      </div>
    </>
  )
}
