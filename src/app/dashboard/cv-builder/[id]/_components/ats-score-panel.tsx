'use client'

import { useState } from 'react'
import { ShieldCheck, Loader2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { serializeATSScoreForContext } from '@/modules/cv/ats-score-schema'
import { usePageContext } from '@/lib/context/page-context'
import type { ATSScoreResult } from '@/modules/cv/ats-score-schema'

type Props = {
  cvId: string
  cvTitle: string
  cvCompany?: string | null
  hasJobDescription: boolean
  result: ATSScoreResult | null
  isPending: boolean
  onRun: () => void
}

const LABEL_COLORS: Record<string, string> = {
  excellent: 'text-emerald-600',
  strong:    'text-green-600',
  good:      'text-amber-600',
  fair:      'text-orange-500',
  poor:      'text-red-500',
}

const DIMENSION_LABELS: Record<string, string> = {
  keywordCoverage:     'Keyword Coverage',
  titleAlignment:      'Title Alignment',
  sectionCompleteness: 'Section Completeness',
  senioritySignal:     'Seniority Signal',
}

export function ATSScorePanel({ cvId, cvTitle, cvCompany, hasJobDescription, result, isPending, onRun }: Props) {
  const [showDetail, setShowDetail] = useState(false)
  const { setContext, openPanel } = usePageContext()

  function handleDiscussWithCoach() {
    if (!result) return
    setContext({
      type: 'cv',
      cvId,
      title: cvTitle,
      company: cvCompany ?? undefined,
      atsScore: serializeATSScoreForContext(result),
    })
    openPanel()
  }

  const { breakdown } = result ?? {}

  return (
    <div className="flex flex-col gap-3">
      {/* Trigger */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRun}
          disabled={isPending || !hasJobDescription}
          title={!hasJobDescription ? 'Attach a job description to enable ATS scoring' : undefined}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isPending
            ? <Loader2 className="size-3.5 animate-spin" />
            : <ShieldCheck className="size-3.5" />}
          {isPending ? 'Checking…' : result ? 'Re-check ATS' : 'Run ATS Check'}
        </button>

        {result && (
          <button
            onClick={handleDiscussWithCoach}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <MessageSquare className="size-3.5" />
            Discuss with coach
          </button>
        )}
      </div>

      {/* Score display */}
      {breakdown && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums">{breakdown.finalScore}</span>
              <span className="text-sm text-muted-foreground">/100</span>
              <span className={`text-sm font-medium capitalize ${LABEL_COLORS[breakdown.label] ?? ''}`}>
                {breakdown.label}
              </span>
            </div>
            <button
              onClick={() => setShowDetail(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showDetail ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {showDetail ? 'Hide' : 'Details'}
            </button>
          </div>

          {/* Score bar */}
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-foreground/70 transition-all"
              style={{ width: `${breakdown.finalScore}%` }}
            />
          </div>

          {/* Dimension breakdown */}
          {showDetail && (
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              {(Object.entries(breakdown.dimensions) as [keyof typeof breakdown.dimensions, (typeof breakdown.dimensions)[keyof typeof breakdown.dimensions]][]).map(([key, dim]) => (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{DIMENSION_LABELS[key]}</span>
                    <span className="font-medium tabular-nums">{Math.round(dim.score)}</span>
                  </div>
                  <div className="mt-0.5 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-foreground/50"
                      style={{ width: `${Math.round(dim.score)}%` }}
                    />
                  </div>
                </div>
              ))}

              {breakdown.dimensions.keywordCoverage.missingRequired.length > 0 && (
                <div className="mt-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Missing required keywords
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {breakdown.dimensions.keywordCoverage.missingRequired.map(kw => (
                      <span
                        key={kw}
                        className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result?.interpretation && (
                <div className="mt-1 border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {result.interpretation.summary}
                  </p>
                  {result.interpretation.profileOpportunities.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Profile opportunities
                      </p>
                      {result.interpretation.profileOpportunities.map((opp, i) => (
                        <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                          <span className="font-medium">{opp.asset}</span> → {opp.targetSection}: {opp.rationale}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
