import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Job not found</h1>
        <p className="text-muted-foreground">
          The job application you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link href="/dashboard/job-applications">
          <Button>Back to applications</Button>
        </Link>
      </div>
    </div>
  )
}
