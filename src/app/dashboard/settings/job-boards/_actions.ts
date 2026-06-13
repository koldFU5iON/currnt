'use server'

import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { encrypt, decrypt } from '@/lib/encryption'
import { normalizeJobBoardApiKeys } from '@/modules/job-hunt/board-sources/schema'
import { Prisma } from '@prisma/client'

export async function saveJobBoardApiKey(provider: 'jsearch', rawKey: string): Promise<void> {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { jobBoardApiKeys: true },
  })
  const current = normalizeJobBoardApiKeys(settings?.jobBoardApiKeys)
  const updated = { ...current, [provider]: encrypt(rawKey) }
  await prisma.userSettings.upsert({
    where: { profileId: profile.id },
    create: { profileId: profile.id, jobBoardApiKeys: updated },
    update: { jobBoardApiKeys: updated },
  })
}

export async function clearJobBoardApiKey(provider: 'jsearch'): Promise<void> {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { jobBoardApiKeys: true },
  })
  const current = normalizeJobBoardApiKeys(settings?.jobBoardApiKeys)
  const { [provider]: _removed, ...rest } = current
  await prisma.userSettings.update({
    where: { profileId: profile.id },
    data: { jobBoardApiKeys: Object.keys(rest).length ? rest : Prisma.JsonNull },
  })
}

export async function getJobBoardKeyStatus(): Promise<{
  adzunaConfigured: boolean
  jSearchConfigured: boolean
}> {
  const { profile } = await requireProfile()
  const settings = await prisma.userSettings.findUnique({
    where: { profileId: profile.id },
    select: { jobBoardApiKeys: true },
  })
  const keys = normalizeJobBoardApiKeys(settings?.jobBoardApiKeys)
  let jSearchOk = false
  if (keys.jsearch) {
    try { decrypt(keys.jsearch); jSearchOk = true } catch { /* corrupt */ }
  }
  return {
    adzunaConfigured: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    jSearchConfigured: jSearchOk,
  }
}
