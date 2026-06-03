import { prisma } from '@/lib/db'
import { completeStructured } from '@/modules/llm/client'
import { loadCVJobAnalysisPrompt, composeSystem } from '@/modules/llm/prompt-context'
import { buildProfileSnapshot, serializeProfileForLLM } from '@/modules/profile/snapshot'
import { JobAnalysisSchema, type JobAnalysis } from '@/modules/jobs/schema'

export async function analyseJob(
  profileId: string,
  jobId: string,
): Promise<JobAnalysis | null> {
  const job = await prisma.jobApplication.findFirst({
    where: { id: jobId, profileId },
    select: { id: true, title: true, company: true, jobDescription: true },
  })

  if (!job || !job.jobDescription?.trim()) return null

  try {
    const [snapshot, systemPrompt] = await Promise.all([
      buildProfileSnapshot(profileId),
      loadCVJobAnalysisPrompt(),
    ])

    const userMessage = [
      `== JOB TARGET ==`,
      `Role: ${job.title} at ${job.company}`,
      '',
      job.jobDescription,
      '',
      '== CANDIDATE PROFILE ==',
      serializeProfileForLLM(snapshot),
    ].join('\n')

    const result = await completeStructured(profileId, userMessage, JobAnalysisSchema, {
      system: composeSystem(systemPrompt),
      feature: 'cv-job-analysis',
      maxOutputTokens: 800,
      temperature: 0.2,
    })

    await prisma.jobApplication.update({
      where: { id: jobId },
      data: { jobAnalysis: result.object, jobAnalysedAt: new Date() },
    })

    return result.object
  } catch (err) {
    console.error('[analyseJob] failed', err)
    return null
  }
}
