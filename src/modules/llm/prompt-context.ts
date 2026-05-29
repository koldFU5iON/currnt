import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/db'

export type WritingContext = {
  rules: string
  brief: string | null
}

export async function loadWritingContext(profileId: string): Promise<WritingContext> {
  const [rules, settings] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/lib/prompts/writing-rules.md'), 'utf-8'),
    prisma.userSettings.findUnique({
      where: { profileId },
      select: { writingBrief: true },
    }),
  ])
  return { rules, brief: settings?.writingBrief ?? null }
}

export function composeSystem(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join('\n\n---\n\n')
}
