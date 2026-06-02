'use server'

import { z } from 'zod'
import { requireProfile } from '@/lib/session'
import { completeStructured } from '@/modules/llm/client'
import { LLMError, type LLMErrorKind } from '@/modules/llm/errors'

const ProjectInsightsSchema = z.object({
  highlights: z.array(z.string()).describe('Key wins, achievements, and impact statements — concise bullet-ready phrases'),
  skills: z.array(z.string()).describe('Technologies, tools, and skills demonstrated in this project'),
})

type ExtractProjectInsightsResult =
  | { ok: true; highlights: string[]; skills: string[] }
  | { ok: false; error: LLMErrorKind; message: string }

export async function extractProjectInsights(
  name: string,
  description: string,
): Promise<ExtractProjectInsightsResult> {
  const { profile } = await requireProfile()

  const prompt = `Extract key highlights and skills from this project for use on a CV/resume.

## Project
**Name:** ${name}

**Description:**
${description}

Return a JSON object with:
- highlights: 2–5 concise bullet-ready phrases capturing key wins, achievements, and impact
- skills: technologies, tools, and skills demonstrated

Focus on impact and concrete outcomes. Highlights should be ready to paste into a CV bullet point.`

  try {
    const result = await completeStructured(profile.id, prompt, ProjectInsightsSchema, {
      maxOutputTokens: 400,
      temperature: 0.3,
      feature: 'project-extract',
    })
    return { ok: true, highlights: result.object.highlights, skills: result.object.skills }
  } catch (err) {
    if (err instanceof LLMError) {
      return { ok: false, error: err.kind, message: err.message }
    }
    throw err
  }
}
