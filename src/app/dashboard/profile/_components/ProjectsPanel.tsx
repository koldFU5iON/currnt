'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
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

  async function handleCreate() {
    if (!newName.trim()) return
    try {
      const created = await createProject({
        name: newName.trim(),
        description: '',
        experienceId,
      })
      const project = created as unknown as Project
      setProjects(prev => [...prev, project])
      setAddingNew(false)
      setNewName('')
      onProjectCreated(project)
      onSelect(created.id)
    } catch {}
  }

  async function handleDelete(id: string) {
    const prev = projects
    setProjects(p => p.filter(p => p.id !== id))
    try { await deleteProject(id) } catch { setProjects(prev) }
  }

  return (
    <div className="flex w-[110px] shrink-0 flex-col border-l">
      <div className="flex items-center justify-between border-b px-2 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Projects
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4"
          onClick={() => setAddingNew(true)}
          aria-label="Add project"
        >
          <Plus size={10} />
        </Button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-1.5">
        {projects.map(project => (
          <div
            key={project.id}
            className={cn(
              'group relative cursor-pointer rounded px-1.5 py-1 text-[11px] leading-snug transition-colors',
              selectedProjectId === project.id
                ? 'border border-emerald-300 bg-emerald-50 font-semibold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'border border-transparent text-muted-foreground hover:bg-muted',
            )}
            onClick={() => onSelect(project.id)}
          >
            <span className="block break-words pr-4">{project.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-0.5 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
              onClick={e => { e.stopPropagation(); void handleDelete(project.id) }}
              aria-label={`Delete ${project.name}`}
            >
              <Trash2 size={8} />
            </Button>
          </div>
        ))}

        {addingNew && (
          <div className="space-y-1">
            <Input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void handleCreate()
                if (e.key === 'Escape') { setAddingNew(false); setNewName('') }
              }}
              placeholder="Project name"
              className="h-6 px-1.5 text-[11px]"
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-5 flex-1 text-[10px]" onClick={() => void handleCreate()}>
                Add
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-5 flex-1 text-[10px]"
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
}
