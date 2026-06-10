import { Skeleton } from '@/components/ui/skeleton'
import { ContentContainer } from '@/app/components/ContentContainer'

export default function Loading() {
  return (
    <ContentContainer title="Job Hunt">
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </ContentContainer>
  )
}
