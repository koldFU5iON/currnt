import { cn } from '@/lib/utils'
import type { ReviewOutput } from '@/modules/writing-guide/schema'

const CATEGORY_LABELS: Record<string, string> = {
  missing_requirement: 'Missing requirement',
  weak_evidence:       'Weak evidence',
  tone:                'Tone',
  motivation:          'Motivation',
  unsupported_claim:   'Unsupported claim',
  repetition:          'Repetition',
}

const SEVERITY_STYLES: Record<string, string> = {
  high:   'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  low:    'bg-muted text-muted-foreground border-border',
}

type Props = { review: ReviewOutput }

export function ReviewResults({ review }: Props) {
  const high   = review.issues.filter(i => i.severity === 'high')
  const medium = review.issues.filter(i => i.severity === 'medium')
  const low    = review.issues.filter(i => i.severity === 'low')

  return (
    <div className="mx-auto max-w-lg px-4 py-10 space-y-8">
      <p className="text-sm italic text-muted-foreground">{review.summary}</p>

      {review.issues.length === 0 && (
        <p className="text-sm font-medium">No significant issues found. Your letter looks solid.</p>
      )}

      {[
        { label: 'High priority', items: high },
        { label: 'Medium priority', items: medium },
        { label: 'Low priority', items: low },
      ].map(({ label, items }) =>
        items.length > 0 ? (
          <div key={label}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              {label}
            </h3>
            <div className="space-y-2">
              {items.map((issue, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-md border px-3 py-2.5 text-sm',
                    SEVERITY_STYLES[issue.severity],
                  )}
                >
                  <span className="font-semibold">{CATEGORY_LABELS[issue.category]}: </span>
                  {issue.description}
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}

      {review.strengths.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            Strengths
          </h3>
          <ul className="space-y-1">
            {review.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
