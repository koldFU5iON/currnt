'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useWorkspaceContext } from '@/lib/context/page-context'
import { buildProfileSummary } from '@/lib/profile-summary'
import {
  updateExperienceNotes,
  updateProjectNotes,
  createExperience,
} from '@/modules/profile/actions'
import type { FullProfile, Project } from '@/app/types/profile'
import { NoteEditor } from './NoteEditor'
import type { SaveState } from './NoteEditor'
import { ExperienceFrontmatter } from './ExperienceFrontmatter'
import { ActivitiesTray } from './ActivitiesTray'
import { ProjectsPanel } from './ProjectsPanel'
import { ExperienceDialog } from './Experience'

type ActiveContext =
  | { type: 'experience' }
  | { type: 'project'; projectId: string }

type Props = {
  profile: FullProfile
}

export function ExperienceWorkspace({ profile }: Props) {
  const router = useRouter()
  const [experiences, setExperiences] = useState(profile.experiences)
  const [allProjects, setAllProjects] = useState(profile.projects)
  const [selectedExperienceId, setSelectedExperienceId] = useState(
    profile.experiences[0]?.id ?? '',
  )
  const [activeContext, setActiveContext] = useState<ActiveContext>({ type: 'experience' })
  const [addOpen, setAddOpen] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const selectedExperience = experiences.find(e => e.id === selectedExperienceId)
  const experienceProjects = allProjects.filter(
    p => p.experienceId === selectedExperienceId,
  )
  const selectedProject =
    activeContext.type === 'project'
      ? allProjects.find(p => p.id === activeContext.projectId) ?? null
      : null

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const profileSummary = useMemo(() => buildProfileSummary(profile), [])

  useWorkspaceContext({
    type: 'profile',
    profileSummary,
    activeExperienceId: selectedExperienceId || undefined,
    activeExperienceName: selectedExperience
      ? `${selectedExperience.role} at ${selectedExperience.company}`
      : undefined,
  })

  function selectExperience(id: string) {
    setSelectedExperienceId(id)
    setActiveContext({ type: 'experience' })
    setSaveState('idle')
  }

  function selectProject(projectId: string) {
    setActiveContext({ type: 'project', projectId })
    setSaveState('idle')
  }

  async function handleAddExperience(data: Parameters<typeof createExperience>[0]) {
    setAddOpen(false)
    const created = await createExperience(data)
    const normalized = {
      ...created,
      tags: [] as string[],
      activities: [] as typeof profile.experiences[0]['activities'],
    }
    setExperiences(prev => [normalized, ...prev])
    selectExperience(created.id)
    router.refresh()
  }

  function handleProjectCreated(project: Project) {
    setAllProjects(prev => [...prev, project])
  }

  const noteKey =
    selectedExperienceId +
    '-' +
    (activeContext.type === 'project' ? activeContext.projectId : 'exp')

  const noteContent =
    activeContext.type === 'project'
      ? (selectedProject?.notes ?? '')
      : (selectedExperience?.summary ?? '')

  const noteSave =
    activeContext.type === 'project'
      ? (content: string) => updateProjectNotes(activeContext.projectId, content)
      : (content: string) => updateExperienceNotes(selectedExperienceId, content)

  const notePlaceholder =
    activeContext.type === 'project'
      ? 'Click to start writing about this project…'
      : 'Click to start writing about this role…'

  if (experiences.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border">
        <p className="text-sm text-muted-foreground">No experience added yet.</p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={13} className="mr-1" /> Add Experience
        </Button>
        {addOpen && (
          <ExperienceDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            onSave={handleAddExperience}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border">
      {/* Tab bar */}
      <div className="flex shrink-0 overflow-x-auto border-b bg-muted/50">
        {experiences.map(exp => (
          <button
            key={exp.id}
            type="button"
            onClick={() => selectExperience(exp.id)}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2 text-xs transition-colors',
              exp.id === selectedExperienceId
                ? '-mb-px border-primary bg-background font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {exp.company} · {new Date(exp.startDate).getFullYear()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="ml-auto whitespace-nowrap px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          + Add
        </button>
      </div>

      {/* Frontmatter */}
      {selectedExperience && (
        <ExperienceFrontmatter
          experience={selectedExperience}
          saveState={saveState}
          projectName={selectedProject?.name}
          onBack={() => setActiveContext({ type: 'experience' })}
        />
      )}

      {/* Main body: note editor + projects panel */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Note + activities column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <NoteEditor
            key={noteKey}
            initialContent={noteContent}
            onSave={noteSave}
            onSaveStateChange={setSaveState}
            placeholder={notePlaceholder}
            className="flex-1"
          />
          {selectedExperience && activeContext.type === 'experience' && (
            <ActivitiesTray
              experienceId={selectedExperienceId}
              initialActivities={selectedExperience.activities}
            />
          )}
        </div>

        {/* Projects panel */}
        {selectedExperience && (
          <ProjectsPanel
            experienceId={selectedExperienceId}
            initialProjects={experienceProjects}
            selectedProjectId={
              activeContext.type === 'project' ? activeContext.projectId : null
            }
            onSelect={selectProject}
            onProjectCreated={handleProjectCreated}
          />
        )}
      </div>

      {addOpen && experiences.length > 0 && (
        <ExperienceDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSave={handleAddExperience}
        />
      )}
    </div>
  )
}
