import { notFound } from "next/navigation"
import { getJobApplicationById } from "@/modules/jobs/queries"
import { requireProfile } from "@/lib/session"
import { getLLMConfigStatus } from "@/modules/llm/client"
import { JobDetailHeader } from "./_components/job-detail-header"
import { JobStatsGrid } from "./_components/job-stats-grid"
import { JobDetailsCard } from "./_components/job-details-card"

export default async function ViewJobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [job, { profile }] = await Promise.all([
    getJobApplicationById(id),
    requireProfile(),
  ])

  if (!job) {
    notFound()
  }

  const { configured: hasLLMKey } = await getLLMConfigStatus(profile.id)

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <JobDetailHeader job={job} />
        <JobStatsGrid job={job} hasLLMKey={hasLLMKey} />
        <JobDetailsCard job={job} />
      </div>
    </div>
  )
}
