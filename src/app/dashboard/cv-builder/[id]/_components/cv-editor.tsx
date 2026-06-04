'use client'

import { useState, useTransition } from 'react'
import { RotateCcw, Download, MessageSquare, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updateSection, toggleVisibility, regenerateCVContent } from '@/modules/cv/actions'
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
  profileName: string
  content: CVDocumentContent
}

type Props = { cv: CVWithMeta }

export function CvEditor({ cv }: Props) {
  const [content, setContent] = useState<CVDocumentContent>(cv.content)
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)

  const displayTitle = cv.jobTitle && cv.company
    ? `${cv.jobTitle} · ${cv.company}`
    : 'Master CV'

  // File-safe slug: Devon-Stanton-CV-Senior-PM_Acme-Corp
  const nameSlug = cv.profileName.replace(/\s+/g, '-')
  const roleSlug = cv.jobTitle ? cv.jobTitle.replace(/\s+/g, '-') : ''
  const companySlug = cv.company ? cv.company.replace(/\s+/g, '-') : ''
  const fileSlug = cv.jobTitle && cv.company
    ? `${nameSlug}-CV-${roleSlug}_${companySlug}`
    : `${nameSlug}-CV`

  function handleUpdateSection(section: CVSection) {
    const prev = content
    setContent(c => ({
      ...c,
      sections: c.sections.map(s => s.id === section.id ? section : s),
    }))
    startTransition(async () => {
      try {
        await updateSection(cv.id, section)
      } catch {
        setContent(prev)
        toast.error('Failed to save changes. Please try again.')
      }
    })
  }

  function handleToggleVisibility(sectionId: string) {
    const prev = content
    setContent(c => ({
      ...c,
      sections: c.sections.map(s =>
        s.id === sectionId ? { ...s, visible: !s.visible } : s
      ),
    }))
    startTransition(async () => {
      try {
        await toggleVisibility(cv.id, sectionId)
      } catch {
        setContent(prev)
        toast.error('Failed to save changes. Please try again.')
      }
    })
  }

  function handleCopySection(section: CVSection) {
    navigator.clipboard.writeText(sectionToPlainText(section))
    toast.success('Section copied to clipboard')
  }

  function confirmRegenerate() {
    setShowConfirm(false)
    startTransition(async () => {
      try {
        const newContent = await regenerateCVContent(cv.id)
        setContent(newContent)
        toast.success('CV regenerated successfully')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Regeneration failed')
      }
    })
  }

  function downloadFile(fileContent: string, filename: string, mime: string) {
    const blob = new Blob([fileContent], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  return (
    <>
      {/* Regenerate confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate CV?</DialogTitle>
            <DialogDescription>
              This will overwrite your current edits with a freshly generated version.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={confirmRegenerate}
              className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
            >
              Regenerate
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex h-full flex-col print:block print:h-auto">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{displayTitle}</span>
            <Badge variant="outline" className="text-xs capitalize">{cv.status}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              {isPending
                ? <Loader2 className="size-3.5 animate-spin" />
                : <RotateCcw className="size-3.5" />
              }
              {isPending ? 'Generating…' : 'Regenerate'}
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
                <button onClick={() => downloadFile(toMarkdown(content), `${fileSlug}.md`, 'text/markdown')} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted">
                  Download Markdown
                </button>
                <button onClick={() => downloadFile(toText(content), `${fileSlug}.txt`, 'text/plain')} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted">
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
        <div className="flex flex-1 overflow-hidden print:overflow-visible print:h-auto print:block">
          <div className="relative flex-1 overflow-y-auto bg-muted/30 p-0 md:p-6 print:overflow-visible print:h-auto print:bg-white print:p-0">
            {isPending && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm print:hidden">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Generating your CV…</p>
                <p className="text-xs text-muted-foreground">This takes about 15–30 seconds</p>
              </div>
            )}
            <div className="cv-document cv-print-area mx-auto w-full max-w-[794px] rounded-none shadow-none md:rounded-lg md:shadow-sm bg-background print:max-w-none print:shadow-none">
              {content.sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-sm font-medium text-muted-foreground">No content yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click Regenerate to generate your CV.
                  </p>
                </div>
              ) : (
                content.sections.map(section => (
                  <CvBlock
                    key={section.id}
                    section={section}
                    onToggleVisibility={() => handleToggleVisibility(section.id)}
                    onCopy={() => handleCopySection(section)}
                  >
                    {renderBlock(section, handleUpdateSection)}
                  </CvBlock>
                ))
              )}
            </div>
          </div>
          <SectionRail sections={content.sections} onToggleVisibility={handleToggleVisibility} />
        </div>
      </div>
    </>
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
