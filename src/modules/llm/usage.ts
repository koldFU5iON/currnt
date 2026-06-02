import { prisma } from '@/lib/db'

export type UserUsageSummary = {
  today: number
  thisMonth: number
  allTime: number
  totalCalls: number
  recentLogs: {
    id: string
    provider: string
    model: string
    feature: string | null
    promptTokens: number
    completionTokens: number
    totalTokens: number
    latencyMs: number
    createdAt: Date
  }[]
}

export type AdminUsageSummary = {
  thisMonthTokens: number
  thisMonthCalls: number
  byFeature: { feature: string | null; totalTokens: number; calls: number }[]
  byProvider: { provider: string; totalTokens: number; calls: number }[]
}

function startOfToday(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfMonth(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export async function getUserUsageSummary(profileId: string): Promise<UserUsageSummary> {
  const [today, thisMonth, allTime, recentLogs] = await Promise.all([
    prisma.llmUsageLog.aggregate({
      where: { profileId, createdAt: { gte: startOfToday() } },
      _sum: { totalTokens: true },
    }),
    prisma.llmUsageLog.aggregate({
      where: { profileId, createdAt: { gte: startOfMonth() } },
      _sum: { totalTokens: true },
    }),
    prisma.llmUsageLog.aggregate({
      where: { profileId },
      _sum: { totalTokens: true },
      _count: { id: true },
    }),
    prisma.llmUsageLog.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, provider: true, model: true, feature: true,
        promptTokens: true, completionTokens: true, totalTokens: true,
        latencyMs: true, createdAt: true,
      },
    }),
  ])

  return {
    today: today._sum.totalTokens ?? 0,
    thisMonth: thisMonth._sum.totalTokens ?? 0,
    allTime: allTime._sum.totalTokens ?? 0,
    totalCalls: allTime._count.id,
    recentLogs,
  }
}

export async function getAdminUsageSummary(): Promise<AdminUsageSummary> {
  const [monthly, byFeature, byProvider] = await Promise.all([
    prisma.llmUsageLog.aggregate({
      where: { createdAt: { gte: startOfMonth() } },
      _sum: { totalTokens: true },
      _count: { id: true },
    }),
    prisma.llmUsageLog.groupBy({
      by: ['feature'],
      _sum: { totalTokens: true },
      _count: { id: true },
      orderBy: { _sum: { totalTokens: 'desc' } },
    }),
    prisma.llmUsageLog.groupBy({
      by: ['provider'],
      _sum: { totalTokens: true },
      _count: { id: true },
      orderBy: { _sum: { totalTokens: 'desc' } },
    }),
  ])

  return {
    thisMonthTokens: monthly._sum.totalTokens ?? 0,
    thisMonthCalls: monthly._count.id,
    byFeature: byFeature.map(r => ({
      feature: r.feature,
      totalTokens: r._sum.totalTokens ?? 0,
      calls: r._count.id,
    })),
    byProvider: byProvider.map(r => ({
      provider: r.provider,
      totalTokens: r._sum.totalTokens ?? 0,
      calls: r._count.id,
    })),
  }
}
