'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { encrypt } from '@/lib/encryption'
import { SUPPORTED_PROVIDERS } from './client'

export type SaveLLMSettingsInput = {
  provider: string
  model: string
  /** When provided, replaces the stored encrypted key. Leave blank to keep existing. */
  apiKey?: string
}

export async function saveLLMSettings(input: SaveLLMSettingsInput): Promise<void> {
  const { profile } = await requireProfile()

  const provider = input.provider.trim()
  const model = input.model.trim()

  if (!SUPPORTED_PROVIDERS.includes(provider as typeof SUPPORTED_PROVIDERS[number])) {
    throw new Error(`Unsupported provider "${provider}"`)
  }
  if (!model) {
    throw new Error('Model is required')
  }

  // Build the patch — only overwrite the encrypted key if the form sent a new one.
  const patch: { llmProvider: string; llmModel: string; llmApiKey?: string } = {
    llmProvider: provider,
    llmModel: model,
  }
  if (input.apiKey && input.apiKey.trim()) {
    patch.llmApiKey = encrypt(input.apiKey.trim())
  }

  await prisma.userSettings.upsert({
    where: { profileId: profile.id },
    update: patch,
    create: {
      profileId: profile.id,
      llmProvider: provider,
      llmModel: model,
      llmApiKey: input.apiKey?.trim() ? encrypt(input.apiKey.trim()) : null,
    },
  })

  revalidatePath('/dashboard/settings/llm')
}

export async function clearLLMApiKey(): Promise<void> {
  const { profile } = await requireProfile()

  await prisma.userSettings.update({
    where: { profileId: profile.id },
    data: { llmApiKey: null },
  })

  revalidatePath('/dashboard/settings/llm')
}

export async function updateWritingBrief(brief: string): Promise<void> {
  const { profile } = await requireProfile()
  const trimmed = brief.trim() || null
  await prisma.userSettings.upsert({
    where: { profileId: profile.id },
    update: { writingBrief: trimmed },
    create: { profileId: profile.id, writingBrief: trimmed },
  })
  revalidatePath('/dashboard/settings/ai-writing')
}
