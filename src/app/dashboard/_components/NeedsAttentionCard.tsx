import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { daysAgo, formatRelative } from "@/lib/utils"
import type { ApplicationStatusType } from "@/app/types/job-application"
import type { DashboardJobSlim } from "@/modules/jobs/queries"

const STATUS_BADGE_VARIANT: Record<ApplicationStatusType, 'secondary' | 'info' | 'outline' | 'success' | 'destructive' | 'warning'> = {
  'not started':  'secondary',
  'in-progress':  'info',
  'applied':      'outline',
  'interviewing': 'success',
  'accepted':     'success',
  'rejected':     'destructive',
}

const STATUS_LABEL: Record<ApplicationStatusType, string> = {
  'not started':  'Not started',
  'in-progress':  'Preparing',
  'applied':      'Applied',
  'interviewing': 'Interviewing',
  'accepted':     'Accepted',
  'rejected':     'Rejected',
}

function staleReason(status: ApplicationStatusType, days: number): string {
  if (status === 'not started') return `Captured ${formatRelative(days)} — start or archive`
  if (status === 'applied')     return `No update for ${formatRelative(days)} — follow up?`
  return `Stale for ${formatRelative(days)}`
}

export function NeedsAttentionCard({ jobs }: { jobs: DashboardJobSlim[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Needs attention</CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <p className="text-sm text-muted-foreground">All jobs are current.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {jobs.map(job => {
              const days = daysAgo(job.lastUpdated) ?? 0
              const reason = staleReason(job.status, days)
              return (
                <li key={job.id}>
                  <Link
                    href={`/dashboard/job-applications/view/${job.id}`}
                    className="group flex flex-col gap-0.5 rounded-md p-2 -mx-2 hover:bg-muted transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate group-hover:text-foreground">
                        {job.company}
                      </span>
                      <Badge variant={STATUS_BADGE_VARIANT[job.status]} className="shrink-0">
                        {STATUS_LABEL[job.status]}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{job.title}</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">{reason}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
