import { ContentContainer } from '@/app/components/ContentContainer'
import { getWatchlist, getDiscoveredJobs } from '@/modules/job-hunt/queries'
import { Watchlist } from './_components/watchlist'
import { DiscoveredJobs } from './_components/discovered-jobs'

export default async function JobHuntPage() {
  const [watches, jobs] = await Promise.all([
    getWatchlist(),
    getDiscoveredJobs(),
  ])

  return (
    <ContentContainer
      title="Job Hunt"
      description="Monitor companies you're interested in and review matched roles as they appear."
    >
      <div className="space-y-8">
        <Watchlist watches={watches} />
        <DiscoveredJobs jobs={jobs} watches={watches} />
      </div>
    </ContentContainer>
  )
}
