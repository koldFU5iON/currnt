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

export const Stage1BriefSchema = z.object({
  rolePurpose: z.string().describe('The specific problem the business is trying to solve — one sentence.'),
  topRequirements: z.array(z.string()).min(1).max(3).describe('Top 3 must-demonstrate requirements from the JD.'),
  track: z.enum(['comms', 'pm', 'marketing', 'bd', 'hybrid']).describe('Primary role track.'),
  selectedProofPoint: z.string().describe('The specific achievement to use as the proof paragraph, with rationale.'),
  gaps: z.array(z.string()).describe('Named gaps in the candidate profile for this role. Empty if none.'),
  screenerCriteria: z.array(z.string()).describe('Named tools, certs, or methodologies explicitly listed in the JD. Empty if none.'),
  closeFormula: z.string().describe('How to close: location, work rights, relocation note if needed.'),
})
export type Stage1Brief = z.infer<typeof Stage1BriefSchema>

export const Stage2ArchitectureSchema = z.object({
  hook: z.string().describe('Opening hook sentence — about the role problem, not the candidate.'),
  connection: z.string().describe('2–3 sentences naming the candidate as the specific answer to that problem.'),
  proofSetup: z.string().describe('Which example, which angle, which metric leads the proof paragraph.'),
  gapAcknowledgement: z.string().nullable().describe('One sentence bridging a structural gap. Null if no material gap.'),
  closeFormula: z.string().describe('Confirmed close text.'),
})
export type Stage2Architecture = z.infer<typeof Stage2ArchitectureSchema>

export const Stage4IssuesSchema = z.object({
  mustFix: z.array(z.object({
    description: z.string().describe('The specific problem.'),
    suggestedFix: z.string().describe('What to change.'),
  })).describe('Issues that would cause a hiring manager to pause.'),
  consider: z.array(z.object({
    description: z.string().describe('Improvement worth making but not blocking.'),
  })).describe('Non-blocking improvements.'),
  wordCount: z.number().describe('Body word count excluding header, salutation, and sign-off.'),
  passesChecklist: z.boolean().describe('True only if all top requirements from Stage 1 are addressed.'),
})
export type Stage4Issues = z.infer<typeof Stage4IssuesSchema>
