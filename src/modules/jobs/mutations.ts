'use server'

import { prisma } from '@/lib/db'
import * as z from 'zod'
import { createJobSchema } from './schema'

export async function createJobApplication(data: z.infer<typeof createJobSchema>) {
  const profile = await prisma.profile.findFirst()
  if (!profile) throw new Error('Profile not found')

  return prisma.jobApplication.create({
    data: {
      ...data,
      profileId: profile.id,
    },
  })
}
