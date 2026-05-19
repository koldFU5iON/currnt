import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex-col m-2 p-4 rounded-2xl border md:w-6xl">
      <h1>Job applications</h1>
      <div className="container w-full border-t border-accent pt-3 mt-2 space-y-3">
        <div className="flex space-x-2 items-center">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-9 w-28" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-md" />
        ))}
      </div>
    </div>
  )
}
