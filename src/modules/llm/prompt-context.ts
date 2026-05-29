import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/db'

export type WritingContext = {
  rules: string
  brief: string | null
}

export async function loadWritingContext(profileId: string): Promise<WritingContext> {
  const rulesPath = path.join(process.cwd(), 'src/lib/prompts/writing-rules.md')
  const [rules, settings] = await Promise.all([
    readFile(rulesPath, 'utf-8').catch(() => {
      throw new Error('writing-rules.md missing from bundle — check outputFileTracingIncludes in next.config.ts')
    }),
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
