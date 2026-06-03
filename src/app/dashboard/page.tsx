import { redirect } from "next/navigation"
import { getOnboardingSettings } from "@/modules/onboarding/queries"
import { getDashboardStats } from "@/modules/jobs/queries"
import { StatsRow } from "./_components/StatsRow"
import { PipelineCard } from "./_components/PipelineCard"
import { NeedsAttentionCard } from "./_components/NeedsAttentionCard"
import { RecentActivityCard } from "./_components/RecentActivityCard"

export default async function Page() {
  const { profile, hasSignal, context } = await getOnboardingSettings()

  if (!hasSignal) redirect("/dashboard/onboarding")

  const stats = await getDashboardStats()

  const displayName = context.preferredName || profile.name || "there"

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {displayName}</h1>
        <p className="text-sm text-muted-foreground mt-1">Here&apos;s where your search stands today.</p>
      </div>

      <StatsRow
        totalActive={stats.totalActive}
        byStatus={stats.byStatus}
        lastActivity={stats.lastActivity}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PipelineCard byStatus={stats.byStatus} totalActive={stats.totalActive} />
        </div>
        <div className="lg:col-span-2">
          <NeedsAttentionCard jobs={stats.staleJobs} />
        </div>
      </div>

      <RecentActivityCard jobs={stats.recentJobs} />
    </div>
  )
}
