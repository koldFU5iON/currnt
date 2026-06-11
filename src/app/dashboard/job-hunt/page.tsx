import { ContentContainer } from '@/app/components/ContentContainer'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { normalizeOnboardingContext } from '@/modules/onboarding/schema'
import { getWatchlist, getDiscoveredJobs } from '@/modules/job-hunt/queries'
import { Watchlist } from './_components/watchlist'
import { DiscoveredJobs } from './_components/discovered-jobs'
import { RoleAliasesInput } from './_components/role-aliases-input'

export default async function JobHuntPage() {
  const { profile } = await requireProfile()

  const [watches, jobs, settings] = await Promise.all([
    getWatchlist(),
    getDiscoveredJobs(),
    prisma.userSettings.findUnique({
      where: { profileId: profile.id },
      select: { onboardingContext: true },
    }),
  ])

  const { additionalRoles } = normalizeOnboardingContext(settings?.onboardingContext)

  return (
    <ContentContainer
      title="Job Hunt"
      description="Monitor companies you're interested in and review matched roles as they appear."
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="min-w-0">
          <DiscoveredJobs jobs={jobs} watches={watches} />
        </div>
        <aside className="space-y-6 lg:sticky lg:top-6">
          <RoleAliasesInput initialRoles={additionalRoles} />
          <Watchlist watches={watches} />
        </aside>
      </div>
    </ContentContainer>
  )
}
