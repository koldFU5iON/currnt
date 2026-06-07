'use client'

import { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { updateCoverLetterContent } from '@/modules/cover-letters/actions'
import { JobAnalysisSchema } from '@/modules/jobs/schema'
import type { CoverLetterWithJob } from '@/modules/cover-letters/queries'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function CoverLetterWorkspace({ letter }: { letter: CoverLetterWithJob }) {
  const [content, setContent] = useState(letter.content)
  const [mode, setMode] = useState<'markdown' | 'preview'>('markdown')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [panelOpen, setPanelOpen] = useState(false)
  const [showEditor, setShowEditor] = useState(letter.content !== '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const save = useCallback(async (value: string) => {
    setSaveState('saving')
    try {
      await updateCoverLetterContent(letter.id, value)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }, [letter.id])

  function handleChange(value: string) {
    setContent(value)
    setSaveState('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(value), 1500)
  }

  function handleStartWriting() {
    setShowEditor(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const job = letter.jobApplication
  const analysis = job?.jobAnalysis
    ? JobAnalysisSchema.safeParse(job.jobAnalysis).data ?? null
    : null
  const title = letter.jobTitle ?? job?.title ?? null
  const company = letter.company ?? job?.company ?? null

  const saveLabel =
    saveState === 'saving' ? 'Saving…' :
    saveState === 'saved' ? 'Saved' :
    saveState === 'error' ? 'Save failed' :
    ''

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-4 border-b px-4 py-2">
        {/* Left */}
        <div className="min-w-0 flex-1">
          {title ? (
            <>
              <p className="truncate text-sm font-semibold">
                {title}{company ? ` · ${company}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">Cover Letter</p>
            </>
          ) : (
            <p className="text-sm font-semibold">Cover Letter</p>
          )}
        </div>

        {/* Centre: mode toggle */}
        <div className="flex shrink-0 overflow-hidden rounded-md border text-xs">
          <button
            onClick={() => setMode('markdown')}
            className={cn(
              'px-3 py-1.5 transition-colors',
              mode === 'markdown'
                ? 'bg-foreground font-semibold text-background'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Markdown
          </button>
          <button
            onClick={() => setMode('preview')}
            className={cn(
              'px-3 py-1.5 transition-colors',
              mode === 'preview'
                ? 'bg-foreground font-semibold text-background'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Preview
          </button>
        </div>

        {/* Right */}
        <div className="flex shrink-0 items-center gap-2">
          {saveLabel && (
            <span className={cn(
              'text-xs',
              saveState === 'error' ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {saveLabel}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigator.clipboard.writeText(content)}
          >
            Copy
          </Button>
          {letter.jobApplicationId && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPanelOpen(o => !o)}
            >
              Job ▸
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Editor / preview area */}
        <div
          className={cn(
            'flex flex-1 justify-center overflow-y-auto bg-secondary p-5 transition-opacity',
            panelOpen && 'opacity-50'
          )}
        >
          <div className="w-full max-w-[560px] rounded-md bg-background p-5 shadow-sm">
            {!showEditor && content === '' ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm font-semibold">No cover letter yet</p>
                <p className="max-w-[280px] text-xs text-muted-foreground">
                  Start writing your cover letter for this role, or open the writing guide to help prepare a draft.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleStartWriting}>
                    Start writing
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    title="Coming soon — requires AI to be configured"
                  >
                    Writing guide
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground opacity-50">
                  Writing guide requires AI to be configured
                </p>
              </div>
            ) : mode === 'markdown' ? (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => handleChange(e.target.value)}
                className="min-h-[400px] w-full resize-none bg-transparent font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
                placeholder="Start writing…"
                autoFocus={showEditor && content === ''}
              />
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content || '*No content yet.*'}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Job context panel */}
        {panelOpen && job && (
          <div className="flex w-[42%] min-w-[240px] flex-col border-l bg-background p-4 overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Job Context</span>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close job context panel"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-sm font-medium">{job.title}</p>
            {job.company && (
              <p className="text-xs text-muted-foreground">{job.company}</p>
            )}
            <p className="mb-3 text-xs text-muted-foreground capitalize">{job.status}</p>

            {analysis ? (
              <>
                {analysis.mustHave.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Must-haves
                    </p>
                    {analysis.mustHave.map((item, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {item}</p>
                    ))}
                  </div>
                )}
                {analysis.niceToHave.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Nice-to-haves
                    </p>
                    {analysis.niceToHave.map((item, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {item}</p>
                    ))}
                  </div>
                )}
              </>
            ) : job.jobDescription ? (
              <div className="mb-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Job Description
                </p>
                <p className="text-xs text-muted-foreground line-clamp-5">
                  {job.jobDescription.slice(0, 300)}
                </p>
                <a
                  href={`/dashboard/job-applications/view/${job.id}`}
                  className="mt-1 text-xs underline"
                >
                  View full description →
                </a>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No job description or analysis available.
              </p>
            )}

            <div className="mt-auto border-t pt-3">
              <p className="text-[10px] text-muted-foreground opacity-50">
                ✦ Writing guide — coming soon
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
