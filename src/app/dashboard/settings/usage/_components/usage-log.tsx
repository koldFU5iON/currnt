import type { UserUsageSummary } from '@/modules/llm/usage'
import { formatDate } from '@/lib/utils'
import { formatTokens } from '@/modules/llm/format'

const FEATURE_LABELS: Record<string, string> = {
  'job-fit': 'Job fit',
  'job-extract': 'Job extract',
  'cv-import': 'CV import',
  'profile-summary': 'Profile summary',
  'profile-extract': 'Profile extract',
  'cv-job-analysis': 'Job analysis',
  'cv-evidence-score': 'Evidence scoring',
  'cv-recruiter-scan': 'Recruiter scan',
  'cv-generate': 'CV generation',
  'cover-letter-analyse':      'Cover letter — analyse role',
  'cover-letter-architect':    'Cover letter — build message',
  'cover-letter-draft':        'Cover letter — write draft',
  'cover-letter-review-pass':  'Cover letter — review draft',
  'cover-letter-finalise':     'Cover letter — finalise',
  'cover-letter-build': 'Cover letter — build with me',
  'cover-letter-review': 'Cover letter — review',
}

export function UsageLog({ stats }: { stats: UserUsageSummary }) {
  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Today', value: formatTokens(stats.today) },
          { label: 'This month', value: formatTokens(stats.thisMonth) },
          { label: 'All time', value: formatTokens(stats.allTime) },
          { label: 'Total calls', value: stats.totalCalls.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Log table */}
      {stats.recentLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No calls yet — use an AI feature to see usage here.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Feature</th>
                <th className="px-3 py-2 text-left font-medium">Model</th>
                <th className="px-3 py-2 text-right font-medium">In</th>
                <th className="px-3 py-2 text-right font-medium">Out</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">ms</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentLogs.map(log => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {log.feature ? (FEATURE_LABELS[log.feature] ?? log.feature) : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {log.provider}/{log.model}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {log.promptTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {log.completionTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                    {log.totalTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {log.latencyMs.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
