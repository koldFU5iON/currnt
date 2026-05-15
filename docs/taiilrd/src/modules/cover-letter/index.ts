// ============================================================
// TAIILRD — Cover Letter Module
// Two modes: writer (LLM drafts) and coach (LLM guides you).
// The coach mode is the differentiator — it helps people find
// their own voice rather than handing them someone else's words.
// ============================================================

import { llmComplete } from '@/modules/llm/adapter'
import type {
  CoverLetterDocument,
  CoverLetterSection,
  CoverLetterFeedback,
  CoverLetterMode,
  LLMConfig,
  UserProfile,
} from '@/types'
import { DEFAULT_COVER_LETTER_SECTIONS } from '@/types'
import { serialiseProfileForLLM } from '@/modules/builder/cv'
import { nanoid } from 'nanoid'

// ------------------------------------------------------------
// Writer Mode — LLM drafts the full cover letter
// ------------------------------------------------------------

export interface WriterModeInput {
  profile: UserProfile
  jobDescription: string
  jobTitle?: string
  company?: string
  cvSummary?: string // optional — pass the CV summary for consistency
  llmConfig: LLMConfig
}

export interface WriterModeResult {
  sections: CoverLetterSection[]
  tokensUsed?: number
}

export async function draftCoverLetter(input: WriterModeInput): Promise<WriterModeResult> {
  const { profile, jobDescription, jobTitle, company, cvSummary, llmConfig } = input

  const profileContext = serialiseProfileForLLM(profile)

  const systemPrompt = `You are an expert cover letter writer. You write compelling, authentic cover letters that feel human and specific — never generic.

Your cover letters:
- Open with a hook that connects the candidate's story to this specific role
- Use concrete proof points with measurable outcomes where possible
- Express genuine interest in this company specifically, not just the role type
- Avoid clichés like "I am writing to apply for", "I am a motivated professional", "I am passionate about"
- Match the tone to the industry and company culture
- Are concise — typically 3-4 short paragraphs

Respond ONLY with valid JSON. No text outside the JSON.`

  const userPrompt = `Write a cover letter for the following role and candidate.

## Target Role
${jobTitle ? `**Title:** ${jobTitle}` : ''}
${company ? `**Company:** ${company}` : ''}

## Job Description
${jobDescription}

${cvSummary ? `## CV Summary (for consistency)\n${cvSummary}` : ''}

## Candidate Profile
${profileContext}

---

Respond with JSON matching this structure exactly:
{
  "sections": [
    {
      "order": 1,
      "label": "Introduction",
      "guidance": "...",
      "llmDraft": "The paragraph text here",
      "status": "reviewed"
    },
    {
      "order": 2,
      "label": "Proof Point",
      "guidance": "...",
      "llmDraft": "The paragraph text here",
      "status": "reviewed"
    },
    {
      "order": 3,
      "label": "Fit Statement",
      "guidance": "...",
      "llmDraft": "The paragraph text here",
      "status": "reviewed"
    },
    {
      "order": 4,
      "label": "Close",
      "guidance": "...",
      "llmDraft": "The paragraph text here",
      "status": "reviewed"
    }
  ]
}`

  const response = await llmComplete(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { ...llmConfig, maxTokens: 2048 }
  )

  const sections = parseWriterResponse(response.content)

  return {
    sections,
    tokensUsed: response.usage
      ? response.usage.inputTokens + response.usage.outputTokens
      : undefined,
  }
}

// ------------------------------------------------------------
// Coach Mode — LLM guides the user section by section
// ------------------------------------------------------------

export interface CoachBriefInput {
  profile: UserProfile
  jobDescription: string
  jobTitle?: string
  company?: string
  llmConfig: LLMConfig
}

export interface CoachBriefResult {
  sections: CoverLetterSection[] // with guidance populated, userDraft empty
}

// Step 1: Generate section briefs — what each section should accomplish
export async function generateCoachBriefs(input: CoachBriefInput): Promise<CoachBriefResult> {
  const { profile, jobDescription, jobTitle, company, llmConfig } = input

  const profileContext = serialiseProfileForLLM(profile)

  const systemPrompt = `You are a cover letter coach helping a job applicant write in their own voice. You do not write for them — you guide them.

Your role is to analyse the job description and candidate profile, then provide specific, actionable guidance for each cover letter section.

Good guidance is:
- Specific to this role and company, not generic
- Directive — tells them what to address and what angle to take
- Points to specific experiences or skills from their profile they should draw on
- Sets a clear goal for what the section should accomplish`

  const userPrompt = `Analyse this job and candidate, then write specific coaching guidance for each cover letter section.

## Target Role
${jobTitle ? `**Title:** ${jobTitle}` : ''}
${company ? `**Company:** ${company}` : ''}

## Job Description
${jobDescription}

## Candidate Profile
${profileContext}

---

Respond with JSON:
{
  "sections": [
    {
      "order": 1,
      "label": "Introduction",
      "guidance": "Specific guidance for this section based on this role and this candidate's background"
    },
    {
      "order": 2,
      "label": "Proof Point",
      "guidance": "Point to a specific experience: [experience name]. Frame it around [specific challenge in JD]."
    },
    {
      "order": 3,
      "label": "Fit Statement",
      "guidance": "Specific guidance..."
    },
    {
      "order": 4,
      "label": "Close",
      "guidance": "Specific guidance..."
    }
  ]
}`

  const response = await llmComplete(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { ...llmConfig, maxTokens: 1024 }
  )

  const rawSections = parseCoachBriefResponse(response.content)

  const sections: CoverLetterSection[] = rawSections.map((s) => ({
    id: nanoid(),
    order: s.order,
    label: s.label,
    guidance: s.guidance,
    userDraft: undefined,
    llmDraft: undefined,
    feedback: undefined,
    status: 'empty' as const,
  }))

  return { sections }
}

// Step 2: Evaluate a user's draft for a specific section
export interface CoachFeedbackInput {
  section: CoverLetterSection
  userDraft: string
  jobDescription: string
  jobTitle?: string
  company?: string
  llmConfig: LLMConfig
}

export interface CoachFeedbackResult {
  feedback: CoverLetterFeedback
  updatedSection: CoverLetterSection
}

export async function evaluateSectionDraft(
  input: CoachFeedbackInput
): Promise<CoachFeedbackResult> {
  const { section, userDraft, jobDescription, jobTitle, company, llmConfig } = input

  const systemPrompt = `You are a cover letter coach evaluating a job applicant's draft for a specific cover letter section. 

Your feedback is:
- Honest and specific — not flattering
- Focused on what the section needs to accomplish (per the brief)
- Actionable — concrete suggestions, not vague advice
- Encouraging of their authentic voice — you are not rewriting for them

Score the section 1–10 where:
1-3: Does not address the goal of this section
4-6: Partially addresses the goal but needs significant work
7-8: Addresses the goal well, minor improvements possible
9-10: Excellent — specific, compelling, authentic

Respond ONLY with valid JSON.`

  const userPrompt = `Evaluate this cover letter section draft.

## Role
${jobTitle || ''} ${company ? `at ${company}` : ''}

## Job Description (excerpt for context)
${jobDescription.slice(0, 800)}

## Section Brief
**Section:** ${section.label}
**Goal:** ${section.guidance}

## User's Draft
${userDraft}

---

Respond with JSON:
{
  "score": number,
  "strengths": ["specific strength 1", "specific strength 2"],
  "suggestions": [
    "Specific, actionable suggestion 1",
    "Specific, actionable suggestion 2"
  ]
}`

  const response = await llmComplete(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { ...llmConfig, maxTokens: 512 }
  )

  const feedbackData = parseFeedbackResponse(response.content)

  const feedback: CoverLetterFeedback = {
    id: nanoid(),
    sectionId: section.id,
    score: feedbackData.score,
    strengths: feedbackData.strengths,
    suggestions: feedbackData.suggestions,
    createdAt: new Date(),
  }

  const updatedSection: CoverLetterSection = {
    ...section,
    userDraft,
    feedback: [...(section.feedback ?? []), feedback],
    status: feedbackData.score >= 7 ? 'reviewed' : 'drafting',
  }

  return { feedback, updatedSection }
}

// Step 3: Assemble the final cover letter from approved sections
export function assembleCoverLetter(
  sections: CoverLetterSection[],
  mode: CoverLetterMode,
  profile: UserProfile,
  recipientName?: string
): string {
  const sorted = [...sections].sort((a, b) => a.order - b.order)

  const greeting = recipientName
    ? `Dear ${recipientName},`
    : 'Dear Hiring Manager,'

  const body = sorted
    .map((s) => {
      const content = mode === 'writer' ? s.llmDraft : s.userDraft
      return content?.trim() ?? ''
    })
    .filter(Boolean)
    .join('\n\n')

  const close = `\nYours sincerely,\n${profile.name}`

  return `${greeting}\n\n${body}${close}`
}

// ------------------------------------------------------------
// Response parsers
// ------------------------------------------------------------

function parseWriterResponse(raw: string): CoverLetterSection[] {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return (parsed.sections ?? []).map((s: Record<string, unknown>, i: number) => ({
      id: nanoid(),
      order: s.order ?? i + 1,
      label: s.label ?? DEFAULT_COVER_LETTER_SECTIONS[i]?.label ?? `Section ${i + 1}`,
      guidance: s.guidance ?? DEFAULT_COVER_LETTER_SECTIONS[i]?.guidance ?? '',
      llmDraft: s.llmDraft ?? '',
      status: 'reviewed' as const,
    }))
  } catch {
    // Fallback: treat raw response as single body
    return [
      {
        id: nanoid(),
        order: 1,
        label: 'Cover Letter',
        guidance: '',
        llmDraft: raw,
        status: 'reviewed' as const,
      },
    ]
  }
}

function parseCoachBriefResponse(raw: string): { order: number; label: string; guidance: string }[] {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    return parsed.sections ?? []
  } catch {
    return DEFAULT_COVER_LETTER_SECTIONS.map((s, i) => ({
      order: s.order,
      label: s.label,
      guidance: s.guidance,
    }))
  }
}

function parseFeedbackResponse(raw: string): {
  score: number
  strengths: string[]
  suggestions: string[]
} {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return { score: 5, strengths: [], suggestions: ['Could not parse feedback response.'] }
  }
}
