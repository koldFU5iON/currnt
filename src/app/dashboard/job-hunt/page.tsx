import { ContentContainer } from '@/app/components/ContentContainer'
import { requireProfile } from '@/lib/session'
import { normalizeOnboardingContext } from '@/modules/onboarding/schema'
import { getWatchlist, getDiscoveredJobs } from '@/modules/job-hunt/queries'
import { getBoardSources, getJobHuntSearch } from '@/modules/job-hunt/board-sources/queries'
import { getJobBoardKeyStatus } from '@/app/dashboard/settings/job-boards/_actions'
import { normalizeJobHuntSearch } from '@/modules/job-hunt/board-sources/schema'
import { Watchlist } from './_components/watchlist'
import { DiscoveredJobs } from './_components/discovered-jobs'
import { ScanSettingsDialog } from './_components/scan-settings-dialog'
import { SearchCriteriaBar } from './_components/search-criteria-bar'
import { JobBoardSources } from './_components/job-board-sources'

export default async function JobHuntPage() {
  await requireProfile()

  const [watches, jobs, boardSources, searchData, keyStatus] = await Promise.all([
    getWatchlist(),
    getDiscoveredJobs(),
    getBoardSources(),
    getJobHuntSearch(),
    getJobBoardKeyStatus(),
  ])

  const { targetRole, currentRole, additionalRoles } = normalizeOnboardingContext(searchData.onboardingContext)
  const searchCriteria = normalizeJobHuntSearch(searchData.jobHuntSearch)

  if (searchCriteria.roles.length === 0 && targetRole) {
    searchCriteria.roles = [targetRole, ...additionalRoles].filter(Boolean)
  }

  const availableProviders = new Set<string>([
    'remotive',
    'remoteok',
    ...(keyStatus.adzunaConfigured ? ['adzuna'] : []),
    ...(keyStatus.jSearchConfigured ? ['jsearch'] : []),
  ])

  return (
    <ContentContainer
      title="Job Hunt"
      description="Scan companies and job boards, then review matched roles."
    >
      <SearchCriteriaBar initial={searchCriteria} />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_280px_1fr] gap-6 items-start">
        <aside className="space-y-6 lg:sticky lg:top-6">
          <ScanSettingsDialog
            targetRole={targetRole}
            currentRole={currentRole}
            additionalRoles={additionalRoles}
          />
          <Watchlist watches={watches} />
        </aside>

        <aside className="lg:sticky lg:top-6">
          <JobBoardSources sources={boardSources} availableProviders={availableProviders} />
        </aside>

        <div className="min-w-0">
          <DiscoveredJobs jobs={jobs} />
        </div>
      </div>
    </ContentContainer>
  )
}
