import { prisma } from '@/lib/db'
import { complete } from '@/modules/llm/client'

const DECAY_CUTOFF_DAYS = 60
const MAX_SUMMARIES = 4

export type DecayWeight = 'full' | 'trimmed' | 'first-sentence'

function classifyAge(createdAt: Date): DecayWeight | 'excluded' {
  const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  if (ageDays < 7) return 'full'
  if (ageDays < 30) return 'trimmed'
  if (ageDays < DECAY_CUTOFF_DAYS) return 'first-sentence'
  return 'excluded'
}

export function applyDecay(summary: string, weight: DecayWeight): string {
  if (weight === 'full') return summary
  const sentences = summary.match(/[^.!?]+[.!?]+/g) ?? [summary]
  if (weight === 'trimmed') return sentences.slice(0, 2).map(s => s.trim()).join(' ')
  return sentences[0]?.trim() ?? summary.slice(0, 120)
}

export async function loadMemorySummaries(profileId: string): Promise<string[]> {
  const since = new Date(Date.now() - DECAY_CUTOFF_DAYS * 24 * 60 * 60 * 1000)
  const rows = await prisma.chatMemory.findMany({
    where: { profileId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: MAX_SUMMARIES,
    select: { summary: true, createdAt: true },
  })
  return rows
    .map(row => {
      const weight = classifyAge(row.createdAt)
      if (weight === 'excluded') return null
      return applyDecay(row.summary, weight)
    })
    .filter((s): s is string => s !== null)
}

export async function saveMemorySummary(
  profileId: string,
  messages: { role: string; content: string }[],
): Promise<void> {
  if (messages.length < 2) return

  const transcript = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
    .join('\n')

  const result = await complete(profileId, transcript, {
    feature: 'chat-summarize',
    system:
      'Summarise this career coaching conversation for future memory recall. ' +
      'Write 1–3 bullet points (max 150 tokens total) capturing: new facts learned about the user, ' +
      'topics discussed, any decisions made. Be specific and factual.',
    maxOutputTokens: 200,
    temperature: 0,
  })

  await prisma.chatMemory.create({
    data: { profileId, summary: result.text.trim() },
  })
}
