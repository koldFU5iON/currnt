import { requireProfile } from '@/lib/session'
import { saveMemorySummary } from '@/modules/chat/memory'
import { SummarizeRequestSchema } from '@/modules/chat/schema'

export async function POST(request: Request) {
  let profileId: string
  try {
    const { profile } = await requireProfile()
    profileId = profile.id
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = SummarizeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  saveMemorySummary(profileId, parsed.data.messages).catch(() => {})

  return Response.json({ ok: true })
}
