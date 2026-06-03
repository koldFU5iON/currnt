import { Briefcase, Clock, MessageSquare, Send } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { daysAgo, formatRelative } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { DashboardStats } from "@/modules/jobs/queries"

type Props = Pick<DashboardStats, 'totalActive' | 'byStatus' | 'lastActivity'>

type StatCardProps = {
  icon: React.ReactNode
  value: string
  label: string
  accent?: 'green' | 'amber' | 'sky'
}

function StatCard({ icon, value, label, accent }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-2xl sm:text-3xl font-semibold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
          <div className={cn(
            "rounded-lg p-2 mt-0.5 shrink-0",
            accent === 'green' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            accent === 'sky'   && "bg-sky-500/10 text-sky-600 dark:text-sky-400",
            accent === 'amber' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            !accent            && "bg-muted text-muted-foreground",
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function StatsRow({ totalActive, byStatus, lastActivity }: Props) {
  const interviewCount = byStatus['interviewing'] ?? 0
  const appliedCount   = byStatus['applied'] ?? 0
  const staleDays      = lastActivity ? daysAgo(lastActivity) : null
  const lastMoveLabel  = staleDays == null ? '—'
    : staleDays <= 0 ? 'today'
    : formatRelative(staleDays)
  const lastMoveAccent = (staleDays ?? 0) > 7 ? 'amber' : undefined

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        icon={<Briefcase className="h-4 w-4" />}
        value={String(totalActive)}
        label="Active pipeline"
      />
      <StatCard
        icon={<MessageSquare className="h-4 w-4" />}
        value={String(interviewCount)}
        label="Interviewing"
        accent={interviewCount > 0 ? 'green' : undefined}
      />
      <StatCard
        icon={<Send className="h-4 w-4" />}
        value={String(appliedCount)}
        label="Applications sent"
        accent={appliedCount > 0 ? 'sky' : undefined}
      />
      <StatCard
        icon={<Clock className="h-4 w-4" />}
        value={lastMoveLabel}
        label="Last activity"
        accent={lastMoveAccent}
      />
    </div>
  )
}
