// ============================================================
// TAIILRD — CV Builder Module
// Assembles a tailored CV from profile data + job description.
// The LLM is the selector and writer. The template is the structure.
// ============================================================

import { llmComplete } from '@/modules/llm/adapter'
import type {
  CVDocument,
  CVGeneratedContent,
  CVTemplate,
  LLMConfig,
  UserProfile,
  CVTemplateSection,
} from '@/types'

// ------------------------------------------------------------
// Default global template
// Research-backed standard structure. Region-specific templates
// extend or override this via the template system.
// ------------------------------------------------------------

export const DEFAULT_GLOBAL_TEMPLATE: Omit<CVTemplate, 'id' | 'createdAt'> = {
  name: 'Standard (Global)',
  region: 'global',
  description: 'A clean, widely-accepted CV structure suitable for most industries and regions.',
  isDefault: true,
  isBuiltIn: true,
  sections: [
    {
      id: 'summary',
      type: 'summary',
      label: 'Professional Summary',
      order: 1,
      required: true,
      maxItems: 1,
      config: { maxWords: 80 },
    },
    {
      id: 'skills',
      type: 'skills',
      label: 'Core Skills',
      order: 2,
      required: true,
      config: {
        maxSkills: 12,
        groupByCategory: false,
        format: 'tags', // tags | bullets | prose
      },
    },
    {
      id: 'experience',
      type: 'experience',
      label: 'Work Experience',
      order: 3,
      required: true,
      maxItems: 5,
      config: {
        maxAchievementsPerRole: 4,
        includeRemoteLabel: true,
      },
    },
    {
      id: 'projects',
      type: 'projects',
      label: 'Projects',
      order: 4,
      required: false,
      maxItems: 3,
      config: {
        includeUrls: true,
      },
    },
    {
      id: 'education',
      type: 'education',
      label: 'Education',
      order: 5,
      required: true,
      config: {},
    },
    {
      id: 'certifications',
      type: 'certifications',
      label: 'Certifications',
      order: 6,
      required: false,
      maxItems: 5,
      config: {},
    },
  ],
}

// ------------------------------------------------------------
// CV Builder — main entry point
// Takes a profile + job description + template, returns a CV
// ------------------------------------------------------------

export interface BuildCVInput {
  profile: UserProfile
  jobDescription: string
  jobTitle?: string
  company?: string
  template: CVTemplate
  llmConfig: LLMConfig
}

export interface BuildCVResult {
  content: CVGeneratedContent
  tokensUsed?: number
}

export async function buildCV(input: BuildCVInput): Promise<BuildCVResult> {
  const { profile, jobDescription, jobTitle, company, template, llmConfig } = input

  // Step 1: Serialise the full profile into a rich context document
  const profileContext = serialiseProfileForLLM(profile)

  // Step 2: Serialise the template structure so the LLM understands the expected output shape
  const templateContext = serialiseTemplateForLLM(template)

  // Step 3: Build the prompt
  const systemPrompt = buildCVSystemPrompt()
  const userPrompt = buildCVUserPrompt({
    profileContext,
    templateContext,
    jobDescription,
    jobTitle,
    company,
  })

  // Step 4: Call LLM
  const response = await llmComplete(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { ...llmConfig, maxTokens: 4096 }
  )

  // Step 5: Parse the structured response
  const content = parseCVResponse(response.content, profile)

  return {
    content,
    tokensUsed: response.usage
      ? response.usage.inputTokens + response.usage.outputTokens
      : undefined,
  }
}

// ------------------------------------------------------------
// Prompts
// ------------------------------------------------------------

function buildCVSystemPrompt(): string {
  return `You are an expert CV writer and career strategist. Your role is to assemble a tailored CV from a candidate's complete profile data, selecting and shaping the most relevant content for a specific job opportunity.

Your approach:
- Read the full profile carefully — it contains raw, unfiltered experience data
- Select only the experiences, skills, and projects most relevant to the target role
- Write the professional summary fresh, tailored to this specific role
- Reframe achievements to emphasise what matters most for this job
- Be honest — do not fabricate or exaggerate, only select and emphasise

Output format:
- Respond ONLY with valid JSON matching the CVGeneratedContent structure
- Include a "tailoringNotes" field explaining your selection rationale (this is shown to the user, not on the CV)
- Do not include any text outside the JSON object`
}

function buildCVUserPrompt({
  profileContext,
  templateContext,
  jobDescription,
  jobTitle,
  company,
}: {
  profileContext: string
  templateContext: string
  jobDescription: string
  jobTitle?: string
  company?: string
}): string {
  return `## Target Role
${jobTitle ? `**Title:** ${jobTitle}` : ''}
${company ? `**Company:** ${company}` : ''}

## Job Description
${jobDescription}

## CV Structure (Template)
${templateContext}

## Candidate Profile
${profileContext}

---

Assemble a tailored CV in JSON format. Select and shape the profile content to best match this role. The JSON must follow this structure:

{
  "summary": "string — professional summary, max 80 words, written for this specific role",
  "sections": [
    {
      "type": "skills",
      "label": "Core Skills",
      "order": 2,
      "content": {
        "skills": ["skill1", "skill2"]
      }
    },
    {
      "type": "experience",
      "label": "Work Experience",
      "order": 3,
      "content": {
        "roles": [
          {
            "company": "string",
            "role": "string",
            "startDate": "string",
            "endDate": "string or null",
            "location": "string or null",
            "remote": boolean,
            "achievements": ["string", "string"]
          }
        ]
      }
    }
  ],
  "selectedSkillIds": ["id1", "id2"],
  "selectedExperienceIds": ["id1", "id2"],
  "selectedProjectIds": ["id1"],
  "tailoringNotes": "string — explain what you selected and why, what you deprioritised and why"
}`
}

// ------------------------------------------------------------
// Profile serialiser — converts UserProfile to LLM-readable text
// Rich and unfiltered — let the LLM do the selection
// ------------------------------------------------------------

export function serialiseProfileForLLM(profile: UserProfile): string {
  const parts: string[] = []

  parts.push(`## Candidate: ${profile.name}`)
  if (profile.headline) parts.push(`**Headline:** ${profile.headline}`)
  if (profile.location) parts.push(`**Location:** ${profile.location}`)

  // Skills — all of them, let LLM filter
  if (profile.skills.length) {
    parts.push('\n### Skills')
    for (const skill of profile.skills) {
      parts.push(
        `- **${skill.name}** (${skill.category}, ${skill.level}` +
        (skill.yearsOfExperience ? `, ${skill.yearsOfExperience}yr` : '') +
        `)` +
        (skill.notes ? ` — ${skill.notes}` : '') +
        ` [id:${skill.id}]`
      )
    }
  }

  // Experiences — full detail
  if (profile.experiences.length) {
    parts.push('\n### Work Experience')
    for (const exp of profile.experiences) {
      const dates = `${formatDate(exp.startDate)} – ${exp.endDate ? formatDate(exp.endDate) : 'Present'}`
      parts.push(
        `\n#### ${exp.role} at ${exp.company} (${dates}) [id:${exp.id}]` +
        (exp.location ? `\n**Location:** ${exp.location}${exp.remote ? ' (Remote)' : ''}` : '')
      )
      parts.push(exp.summary)

      if (exp.achievements.length) {
        parts.push('**Achievements:**')
        for (const a of exp.achievements) {
          parts.push(`- ${a.description}${a.impact ? ` → ${a.impact}` : ''}`)
        }
      }
    }
  }

  // Projects
  if (profile.projects.length) {
    parts.push('\n### Projects')
    for (const proj of profile.projects) {
      parts.push(
        `\n#### ${proj.name} (${proj.status}) [id:${proj.id}]` +
        (proj.url ? ` | ${proj.url}` : '')
      )
      parts.push(proj.description)
      if (proj.highlights.length) {
        for (const h of proj.highlights) {
          parts.push(`- ${h}`)
        }
      }
    }
  }

  // Education
  if (profile.education.length) {
    parts.push('\n### Education')
    for (const edu of profile.education) {
      parts.push(
        `- ${edu.qualification}${edu.field ? ` in ${edu.field}` : ''} — ${edu.institution}` +
        (edu.grade ? ` (${edu.grade})` : '') +
        ` (${formatDate(edu.startDate)} – ${edu.endDate ? formatDate(edu.endDate) : 'Present'})`
      )
    }
  }

  // Certifications
  if (profile.certifications.length) {
    parts.push('\n### Certifications')
    for (const cert of profile.certifications) {
      parts.push(`- ${cert.name} — ${cert.issuer} (${formatDate(cert.issueDate)})`)
    }
  }

  return parts.join('\n')
}

// ------------------------------------------------------------
// Template serialiser
// ------------------------------------------------------------

function serialiseTemplateForLLM(template: CVTemplate): string {
  const lines = [`Template: ${template.name}`, '']
  for (const section of [...template.sections].sort((a, b) => a.order - b.order)) {
    lines.push(
      `${section.order}. ${section.label} (${section.type})` +
      (section.required ? ' [required]' : ' [optional]') +
      (section.maxItems ? ` — max ${section.maxItems} items` : '')
    )
  }
  return lines.join('\n')
}

// ------------------------------------------------------------
// Response parser
// ------------------------------------------------------------

function parseCVResponse(rawResponse: string, _profile: UserProfile): CVGeneratedContent {
  const cleaned = rawResponse
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned)

    return {
      summary: parsed.summary ?? '',
      sections: parsed.sections ?? [],
      selectedSkillIds: parsed.selectedSkillIds ?? [],
      selectedExperienceIds: parsed.selectedExperienceIds ?? [],
      selectedProjectIds: parsed.selectedProjectIds ?? [],
      tailoringNotes: parsed.tailoringNotes,
    }
  } catch {
    // Graceful fallback — return what we can
    return {
      summary: rawResponse.slice(0, 500),
      sections: [],
      selectedSkillIds: [],
      selectedExperienceIds: [],
      selectedProjectIds: [],
      tailoringNotes: 'Failed to parse structured response — raw content preserved in summary.',
    }
  }
}

// ------------------------------------------------------------
// Utils
// ------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

// ------------------------------------------------------------
// Template registry — where community templates will live
// ------------------------------------------------------------

export interface TemplateRegistry {
  templates: CVTemplate[]
  getById: (id: string) => CVTemplate | undefined
  getByRegion: (region: string) => CVTemplate[]
  getDefault: () => CVTemplate | undefined
}

export function createTemplateRegistry(templates: CVTemplate[]): TemplateRegistry {
  return {
    templates,
    getById: (id) => templates.find((t) => t.id === id),
    getByRegion: (region) => templates.filter((t) => t.region === region),
    getDefault: () => templates.find((t) => t.isDefault),
  }
}
