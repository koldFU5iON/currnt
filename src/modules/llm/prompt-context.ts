import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/db'

export type WritingContext = {
  rules: string
  brief: string | null
}

export async function loadWritingRules(): Promise<string> {
  const rulesPath = path.join(process.cwd(), 'src/lib/prompts/writing-rules.md')
  return readFile(rulesPath, 'utf-8').catch(() => {
    throw new Error('writing-rules.md missing from bundle — check outputFileTracingIncludes in next.config.ts')
  })
}

export async function loadCVPrompt(): Promise<string> {
  const promptPath = path.join(process.cwd(), 'src/lib/prompts/cv-generate.md')
  return readFile(promptPath, 'utf-8').catch(() => {
    throw new Error('cv-generate.md missing from bundle — check outputFileTracingIncludes in next.config.ts')
  })
}

export async function loadCVJobAnalysisPrompt(): Promise<string> {
  const promptPath = path.join(process.cwd(), 'src/lib/prompts/cv-job-analysis.md')
  return readFile(promptPath, 'utf-8').catch(() => {
    throw new Error('cv-job-analysis.md missing from bundle — check outputFileTracingIncludes in next.config.ts')
  })
}

export async function loadEvidenceScoringPrompt(): Promise<string> {
  const promptPath = path.join(process.cwd(), 'src/lib/prompts/cv-evidence-score.md')
  return readFile(promptPath, 'utf-8').catch(() => {
    throw new Error('cv-evidence-score.md missing from bundle — check outputFileTracingIncludes in next.config.ts')
  })
}

export async function loadCVScanPrompt(): Promise<string> {
  const promptPath = path.join(process.cwd(), 'src/lib/prompts/cv-recruiter-scan.md')
  return readFile(promptPath, 'utf-8').catch(() => {
    throw new Error('cv-recruiter-scan.md missing from bundle — check outputFileTracingIncludes in next.config.ts')
  })
}

export async function loadWritingContext(profileId: string): Promise<WritingContext> {
  const [rules, settings] = await Promise.all([
    loadWritingRules().catch(() => ''),
    prisma.userSettings.findUnique({
      where: { profileId },
      select: { writingBrief: true },
    }),
  ])
  return { rules, brief: settings?.writingBrief ?? null }
}

export function composeSystem(...parts: (string | null | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p)).join('\n\n---\n\n')
}
