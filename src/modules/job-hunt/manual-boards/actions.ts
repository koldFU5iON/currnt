'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { ManualBoardSchema } from './schema'
import type { ManualBoard } from './schema'

type AddResult = { ok: true } | { ok: false; error: string }
type RemoveResult = { ok: true } | { ok: false; error: 'not_found' }

export async function addManualBoard(data: ManualBoard): Promise<AddResult> {
  const parsed = ManualBoardSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { profile } = await requireProfile()
  await prisma.manualJobBoard.create({
    data: { profileId: profile.id, ...parsed.data },
  })
  revalidatePath('/dashboard/job-hunt')
  return { ok: true }
}

export async function removeManualBoard(id: string): Promise<RemoveResult> {
  const { profile } = await requireProfile()
  const board = await prisma.manualJobBoard.findFirst({ where: { id, profileId: profile.id } })
  if (!board) return { ok: false, error: 'not_found' }
  await prisma.manualJobBoard.delete({ where: { id } })
  revalidatePath('/dashboard/job-hunt')
  return { ok: true }
}
