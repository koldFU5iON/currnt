import { requireProfile } from '@/lib/session'
import { getUserUsageSummary } from '@/modules/llm/usage'

export async function GET() {
  try {
    const { profile } = await requireProfile()
    const { today, thisMonth } = await getUserUsageSummary(profile.id)
    return Response.json({ today, thisMonth })
  } catch {
    return Response.json({ today: 0, thisMonth: 0 }, { status: 200 })
  }
}
