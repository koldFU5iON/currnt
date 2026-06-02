import type { AdminUsageSummary } from '@/modules/llm/usage'
import { formatTokens } from '@/modules/llm/format'

export function UsageAdmin({ stats }: { stats: AdminUsageSummary }) {
  return (
    <div className="mt-8 space-y-4 border-t pt-6">
      <h2 className="text-sm font-semibold">Admin — all users this month</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Tokens</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatTokens(stats.thisMonthTokens)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Calls</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{stats.thisMonthCalls.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">By feature</p>
          <table className="w-full text-sm">
            <tbody>
              {stats.byFeature.map(r => (
                <tr key={r.feature ?? 'unknown'} className="border-b last:border-0">
                  <td className="px-3 py-1.5 text-xs">{r.feature ?? 'unknown'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-xs text-muted-foreground">{formatTokens(r.totalTokens)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-xs text-muted-foreground">{r.calls} calls</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">By provider</p>
          <table className="w-full text-sm">
            <tbody>
              {stats.byProvider.map(r => (
                <tr key={r.provider} className="border-b last:border-0">
                  <td className="px-3 py-1.5 text-xs capitalize">{r.provider}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-xs text-muted-foreground">{formatTokens(r.totalTokens)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-xs text-muted-foreground">{r.calls} calls</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
