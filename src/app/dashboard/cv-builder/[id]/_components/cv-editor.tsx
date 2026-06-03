'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Download, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { createAndGenerateCV, updateSection, toggleVisibility } from '@/modules/cv/actions'
import { toMarkdown, toText, sectionToPlainText } from '@/modules/cv/export'
import { SectionRail } from './section-rail'
import { CvBlock } from './cv-block'
import { HeaderBlock } from './blocks/header-block'
import { ProfileBlock } from './blocks/profile-block'
import { CompetenciesBlock } from './blocks/competencies-block'
import { CapabilitiesBlock } from './blocks/capabilities-block'
import { ExperienceBlock } from './blocks/experience-block'
import { EducationBlock } from './blocks/education-block'
import { CertificationBlock } from './blocks/certification-block'
import { SkillsBlock } from './blocks/skills-block'
import { ToolsBlock } from './blocks/tools-block'
import { LanguagesBlock } from './blocks/languages-block'
import type { CVDocumentContent, CVSection } from '@/modules/cv/schema'

type CVWithMeta = {
  id: string
  status: string
  jobTitle: string | null
  company: string | null
  jobApplicationId: string | null
  content: CVDocumentContent
}

type Props = { cv: CVWithMeta }

export function CvEditor({ cv }: Props) {
  const router = useRouter()
  const [content, setContent] = useState<CVDocumentContent>(cv.content)
  const [isPending, startTransition] = useTransition()

  const title = cv.jobTitle && cv.company
    ? `${cv.jobTitle} · ${cv.company}`
    : 'Master CV'

  function handleUpdateSection(section: CVSection) {
    setContent(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === section.id ? section : s),
    }))
    startTransition(async () => { await updateSection(cv.id, section) })
  }

  function handleToggleVisibility(sectionId: string) {
    setContent(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId ? { ...s, visible: !s.visible } : s
      ),
    }))
    startTransition(async () => { await toggleVisibility(cv.id, sectionId) })
  }

  function handleCopySection(section: CVSection) {
    navigator.clipboard.writeText(sectionToPlainText(section))
  }

  function handleRegenerate() {
    if (!confirm('This will overwrite your current edits. Continue?')) return
    startTransition(async () => {
      await createAndGenerateCV({ jobApplicationId: cv.jobApplicationId ?? undefined })
      router.refresh()
    })
  }

  function downloadFile(fileContent: string, filename: string, mime: string) {
    const blob = new Blob([fileContent], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <Badge variant="outline" className="text-xs capitalize">{cv.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" />
            Regenerate
          </button>
          <div className="relative group">
            <button className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
              <Download className="size-3.5" />
              Export
            </button>
            <div className="absolute right-0 top-full z-10 hidden w-40 rounded-md border border-border bg-background py-1 shadow-md group-hover:block">
              <button onClick={() => window.print()} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted">
                Download PDF
              </button>
              <button onClick={() => downloadFile(toMarkdown(content), `${slug}.md`, 'text/markdown')} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted">
                Download Markdown
              </button>
              <button onClick={() => downloadFile(toText(content), `${slug}.txt`, 'text/plain')} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted">
                Download Text
              </button>
            </div>
          </div>
          <button disabled title="Coming soon" className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground opacity-50">
            <MessageSquare className="size-3.5" />
            Discuss
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-muted/30 p-6 print:bg-white print:p-0">
          <div className="cv-print-area mx-auto max-w-2xl rounded-lg bg-background shadow-sm print:max-w-none print:shadow-none">
            {content.sections.map(section => (
              <CvBlock
                key={section.id}
                section={section}
                onToggleVisibility={() => handleToggleVisibility(section.id)}
                onCopy={() => handleCopySection(section)}
              >
                {renderBlock(section, handleUpdateSection)}
              </CvBlock>
            ))}
          </div>
        </div>
        <SectionRail sections={content.sections} onToggleVisibility={handleToggleVisibility} />
      </div>
    </div>
  )
}

function renderBlock(section: CVSection, onUpdate: (s: CVSection) => void) {
  switch (section.type) {
    case 'header':        return <HeaderBlock section={section} onUpdate={onUpdate} />
    case 'profile':       return <ProfileBlock section={section} onUpdate={onUpdate} />
    case 'competencies':  return <CompetenciesBlock section={section} onUpdate={onUpdate} />
    case 'capabilities':  return <CapabilitiesBlock section={section} onUpdate={onUpdate} />
    case 'experience':    return <ExperienceBlock section={section} onUpdate={onUpdate} />
    case 'education':     return <EducationBlock section={section} onUpdate={onUpdate} />
    case 'certification': return <CertificationBlock section={section} onUpdate={onUpdate} />
    case 'skills':        return <SkillsBlock section={section} onUpdate={onUpdate} />
    case 'tools':         return <ToolsBlock section={section} onUpdate={onUpdate} />
    case 'languages':     return <LanguagesBlock section={section} onUpdate={onUpdate} />
  }
}
