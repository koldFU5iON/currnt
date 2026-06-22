'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'

export async function updateCVGenerationSettings(data: {
  mergeRepeatedEmployers: boolean
}): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.userSettings.upsert({
    where: { profileId: profile.id },
    create: { profileId: profile.id, mergeRepeatedEmployers: data.mergeRepeatedEmployers },
    update: { mergeRepeatedEmployers: data.mergeRepeatedEmployers },
  })
  revalidatePath('/dashboard/settings/cv-generation')
}
