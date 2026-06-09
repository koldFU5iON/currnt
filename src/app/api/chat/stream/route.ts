import { streamText, stepCountIs, convertToModelMessages, type LanguageModel, type UIMessage } from 'ai'
import { after } from 'next/server'
import { requireProfile } from '@/lib/session'
import { prisma } from '@/lib/db'
import { resolveModelForChat } from '@/modules/llm/client'
import { LLMError } from '@/modules/llm/errors'
import { buildSystemPrompt } from '@/modules/chat/context'
import { createChatTools } from '@/modules/chat/tools'
import { PageContextSchema } from '@/modules/chat/schema'

export const maxDuration = 60

export async function POST(request: Request) {
  let profileId: string
  try {
    const { profile } = await requireProfile()
    profileId = profile.id
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const messages = body.messages as UIMessage[]
  const pageContext = body.pageContext ?? null

  const ctxParsed = PageContextSchema.nullable().safeParse(pageContext)
  if (!ctxParsed.success) {
    return Response.json({ error: ctxParsed.error.flatten() }, { status: 400 })
  }

  let resolvedChat: { languageModel: LanguageModel; provider: string; model: string }
  try {
    resolvedChat = await resolveModelForChat(profileId)
  } catch (err) {
    const llmErr = err instanceof LLMError ? err : null
    if (llmErr?.kind === 'not_configured') {
      return Response.json({ error: 'not_configured' }, { status: 412 })
    }
    return Response.json(
      { error: llmErr?.message ?? (err instanceof Error ? err.message : 'LLM error') },
      { status: 503 },
    )
  }

  const systemPrompt = await buildSystemPrompt(profileId, ctxParsed.data)

  const modelMessages = await convertToModelMessages(messages)

  const result = streamText({
    model: resolvedChat.languageModel,
    system: systemPrompt,
    messages: modelMessages,
    tools: createChatTools(profileId),
    stopWhen: stepCountIs(5),
    maxOutputTokens: 2048,
    onFinish: ({ totalUsage }) => {
      after(async () => {
        await prisma.llmUsageLog
          .create({
            data: {
              profileId,
              provider: resolvedChat.provider,
              model: resolvedChat.model,
              feature: 'chat-turn',
              promptTokens: totalUsage.inputTokens ?? 0,
              completionTokens: totalUsage.outputTokens ?? 0,
              totalTokens: totalUsage.totalTokens ?? 0,
              latencyMs: 0,
            },
          })
          .catch(() => {})
      })
    },
  })

  return result.toUIMessageStreamResponse()
}
