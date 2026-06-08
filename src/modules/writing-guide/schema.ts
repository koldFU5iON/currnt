import { z } from 'zod'

export const BuildWithMeInputs = z.object({
  whyRole:       z.string().optional().describe('Why the candidate wants this specific role.'),
  whyCompany:    z.string().optional().describe('Why the candidate wants to work at this company.'),
  bestEvidence:  z.string().optional().describe('The experience or achievement that best proves fit.'),
  whyNow:        z.string().optional().describe('Why the candidate is making this move now.'),
  anythingElse:  z.string().optional().describe('Any other context the hiring manager should know.'),
})

export type BuildWithMeInputs = z.infer<typeof BuildWithMeInputs>

export const ReviewOutputSchema = z.object({
  issues: z.array(z.object({
    category: z.enum([
      'missing_requirement',
      'weak_evidence',
      'tone',
      'motivation',
      'unsupported_claim',
      'repetition',
    ]).describe('Type of issue found in the letter.'),
    severity: z.enum(['high', 'medium', 'low'])
      .describe('high = likely to cause rejection; medium = weakens application; low = minor improvement.'),
    description: z.string()
      .describe('Plain English explanation of the issue, 1–2 sentences. Be specific.'),
  })),
  strengths: z.array(z.string().describe('One thing the letter does well, one sentence.')),
  summary: z.string().describe('One sentence overall assessment of the letter.'),
})

export type ReviewOutput = z.infer<typeof ReviewOutputSchema>
