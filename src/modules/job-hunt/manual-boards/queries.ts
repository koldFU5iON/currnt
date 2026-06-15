import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'

export async function getManualBoards() {
  const { profile } = await requireProfile()
  return prisma.manualJobBoard.findMany({
    where: { profileId: profile.id },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  })
}
