import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col m-2 p-4 rounded-2xl border md:w-6xl">
      <h1 className="text-xl font-semibold mb-4">Job applications</h1>

      {/* Filter bar */}
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
        <div className="ml-auto">
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      {/* Column header strip */}
      <div className="flex gap-3 px-3 pb-2 opacity-40">
        <Skeleton className="h-3 w-4 rounded" />
        <Skeleton className="h-3 w-28 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-12 rounded" />
        <Skeleton className="h-3 w-8 rounded" />
      </div>

      {/* Row skeletons */}
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border/20" style={{ opacity: 1 - i * 0.15 }}>
            <Skeleton className="size-4 rounded" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-48 rounded" />
              <Skeleton className="h-2.5 w-32 rounded" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-2 w-20 rounded-full" />
            <Skeleton className="h-3 w-14 rounded" />
            <Skeleton className="h-3 w-8 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
