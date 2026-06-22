'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'

export async function updateCVGenerationSettings(data: {
  mergeRepeatedEmployers: boolean
}): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.userSettings.update({
    where: { profileId: profile.id },
    data: { mergeRepeatedEmployers: data.mergeRepeatedEmployers },
  })
  revalidatePath('/dashboard/settings/cv-generation')
}
