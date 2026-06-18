import { Skeleton } from '@/components/ui/skeleton'
import { ContentContainer } from '@/app/components/ContentContainer'

export default function Loading() {
  return (
    <ContentContainer title="Job Hunt" description="Scan companies and job boards, then review matched roles." fullWidth>
      {/* Criteria bar */}
      <Skeleton className="h-12 w-full rounded-lg mb-4" />
      {/* Sync status bar */}
      <Skeleton className="h-10 w-full rounded-lg mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_280px_1fr] gap-6 items-start">
        {/* Watchlist skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-3 w-28 rounded opacity-60" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" style={{ opacity: 1 - i * 0.2 }} />
            ))}
          </div>
        </div>

        {/* Job boards skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" style={{ opacity: 1 - i * 0.2 }} />
            ))}
          </div>
        </div>

        {/* Discovered jobs skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-3 w-32 rounded opacity-60" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        </div>
      </div>
    </ContentContainer>
  )
}
