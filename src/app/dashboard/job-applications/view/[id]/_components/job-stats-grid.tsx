import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type Job } from "@/app/types/job-application"
import { formatDate } from "@/lib/utils"

export function JobStatsGrid({ job }: { job: Job }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="Status">
        <Badge className="capitalize">{job.status}</Badge>
      </StatCard>
      <StatCard label="Progress">
        <p className="font-semibold text-sm capitalize">{job.progress}</p>
      </StatCard>
      <StatCard label="Applied">
        <p className="font-semibold text-sm">{formatDate(job.dateApplied)}</p>
      </StatCard>
      <StatCard label="Updated">
        <p className="font-semibold text-sm">{formatDate(job.lastUpdated)}</p>
      </StatCard>
    </div>
  )
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
