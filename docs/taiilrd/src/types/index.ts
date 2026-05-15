// ============================================================
// TAIILRD — Core Type Definitions
// The foundational data model. Everything builds on this.
// ============================================================

// ------------------------------------------------------------
// PROFILE VAULT
// Atomic profile units — the raw ingredients of a CV
// Each type maps to a markdown file with YAML frontmatter
// ------------------------------------------------------------

export type SkillLevel = 'familiar' | 'proficient' | 'expert'
export type SkillCategory = 'technical' | 'soft' | 'domain' | 'tool' | 'language'

export interface Skill {
  id: string
  name: string
  category: SkillCategory
  level: SkillLevel
  yearsOfExperience?: number
  tags: string[]
  notes?: string // freeform markdown prose
  createdAt: Date
  updatedAt: Date
}

export interface Experience {
  id: string
  company: string
  role: string
  startDate: Date
  endDate?: Date // null = current
  location?: string
  remote: boolean
  summary: string // 1–2 sentence prose overview
  achievements: Achievement[]
  skillIds: string[] // references Skill ids
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface Achievement {
  id: string
  experienceId: string
  description: string // freeform prose, rich and unfiltered
  impact?: string // quantifiable outcome if available
  skillIds: string[]
  tags: string[]
}

export interface Project {
  id: string
  name: string
  description: string // freeform markdown prose
  url?: string
  repoUrl?: string
  startDate?: Date
  endDate?: Date
  status: 'active' | 'completed' | 'archived'
  skillIds: string[]
  tags: string[]
  highlights: string[] // bullet points of key wins
  createdAt: Date
  updatedAt: Date
}

export interface Education {
  id: string
  institution: string
  qualification: string
  field?: string
  startDate: Date
  endDate?: Date
  grade?: string
  notes?: string // freeform markdown prose
  tags: string[]
}

export interface Certification {
  id: string
  name: string
  issuer: string
  issueDate: Date
  expiryDate?: Date
  credentialUrl?: string
  skillIds: string[]
  tags: string[]
}

// The full profile — all vault data for a user
export interface UserProfile {
  id: string
  name: string
  email?: string
  phone?: string
  location?: string
  website?: string
  linkedIn?: string
  github?: string
  headline?: string // professional summary seed
  skills: Skill[]
  experiences: Experience[]
  projects: Project[]
  education: Education[]
  certifications: Certification[]
  createdAt: Date
  updatedAt: Date
}

// ------------------------------------------------------------
// CV BUILDER
// ------------------------------------------------------------

export type CVSectionType =
  | 'summary'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'education'
  | 'certifications'
  | 'custom'

export interface CVTemplate {
  id: string
  name: string
  region: string // e.g. 'global', 'uk', 'us', 'fr', 'de'
  description: string
  sections: CVTemplateSection[]
  isDefault: boolean
  isBuiltIn: boolean // false = community/user-created
  createdAt: Date
}

export interface CVTemplateSection {
  id: string
  type: CVSectionType
  label: string
  order: number
  required: boolean
  maxItems?: number // e.g. limit experience to 4 roles
  config: Record<string, unknown> // section-specific options
}

export interface CVDocument {
  id: string
  profileId: string
  jobApplicationId?: string
  templateId: string
  jobDescription?: string
  jobTitle?: string
  company?: string
  generatedContent: CVGeneratedContent
  status: 'draft' | 'final'
  createdAt: Date
  updatedAt: Date
}

export interface CVGeneratedContent {
  summary: string
  sections: CVSection[]
  selectedSkillIds: string[]
  selectedExperienceIds: string[]
  selectedProjectIds: string[]
  tailoringNotes?: string // LLM's reasoning for what it picked and why
}

export interface CVSection {
  type: CVSectionType
  label: string
  order: number
  content: unknown // typed per section in the builder module
}

// ------------------------------------------------------------
// COVER LETTER
// ------------------------------------------------------------

export type CoverLetterMode = 'writer' | 'coach'

export interface CoverLetterDocument {
  id: string
  profileId: string
  jobApplicationId?: string
  cvDocumentId?: string
  mode: CoverLetterMode
  jobDescription?: string
  jobTitle?: string
  company?: string
  sections: CoverLetterSection[]
  status: 'draft' | 'final'
  createdAt: Date
  updatedAt: Date
}

export interface CoverLetterSection {
  id: string
  order: number
  label: string // e.g. "Introduction", "Proof Point", "Fit Statement"
  guidance: string // what this section should accomplish
  userDraft?: string // what the user has written (coach mode)
  llmDraft?: string // what the LLM wrote (writer mode)
  feedback?: CoverLetterFeedback[] // coach mode evaluations
  status: 'empty' | 'drafting' | 'reviewed' | 'approved'
}

export interface CoverLetterFeedback {
  id: string
  sectionId: string
  score: number // 1–10
  strengths: string[]
  suggestions: string[]
  createdAt: Date
}

// Standard cover letter structure — extensible
export const DEFAULT_COVER_LETTER_SECTIONS: Omit<CoverLetterSection, 'id' | 'userDraft' | 'llmDraft' | 'feedback'>[] = [
  {
    order: 1,
    label: 'Introduction',
    guidance: 'Open with who you are and a direct connection to the role. Reference something specific about the company or position.',
    status: 'empty',
  },
  {
    order: 2,
    label: 'Proof Point',
    guidance: 'Demonstrate you can solve a specific problem relevant to this role. Use a concrete example with measurable outcome where possible.',
    status: 'empty',
  },
  {
    order: 3,
    label: 'Fit Statement',
    guidance: 'Explain why this role and this company specifically — not just why you are qualified, but why this is the right move for both sides.',
    status: 'empty',
  },
  {
    order: 4,
    label: 'Close',
    guidance: 'Confident, brief. Signal next steps without being presumptuous.',
    status: 'empty',
  },
]

// ------------------------------------------------------------
// JOB TRACKER
// ------------------------------------------------------------

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'
  | 'archived'

export interface JobApplication {
  id: string
  profileId: string
  jobTitle: string
  company: string
  jobDescription?: string
  jobUrl?: string
  location?: string
  remote?: boolean
  salaryMin?: number
  salaryMax?: number
  currency?: string
  status: ApplicationStatus
  appliedAt?: Date
  notes?: string
  cvDocumentId?: string
  coverLetterDocumentId?: string
  contacts: ApplicationContact[]
  events: ApplicationEvent[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface ApplicationContact {
  id: string
  applicationId: string
  name: string
  role?: string
  email?: string
  linkedIn?: string
  notes?: string
}

export interface ApplicationEvent {
  id: string
  applicationId: string
  type: 'note' | 'interview' | 'followup' | 'offer' | 'rejection' | 'status_change'
  title: string
  description?: string
  scheduledAt?: Date
  completedAt?: Date
  createdAt: Date
}

// ------------------------------------------------------------
// LLM ABSTRACTION
// Provider-agnostic — never hardcode a provider
// ------------------------------------------------------------

export type LLMProvider = 'anthropic' | 'openai' | 'google' | 'ollama' | 'custom'

export interface LLMConfig {
  provider: LLMProvider
  apiKey?: string // null for ollama/local
  model: string
  baseUrl?: string // for custom/ollama endpoints
  maxTokens?: number
  temperature?: number
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  provider: LLMProvider
  model: string
}

// ------------------------------------------------------------
// MARKDOWN VAULT FILE
// Represents a parsed markdown file from the profile vault
// ------------------------------------------------------------

export type VaultFileType = 'skill' | 'experience' | 'project' | 'education' | 'certification'

export interface VaultFile {
  type: VaultFileType
  slug: string // filename without extension
  frontmatter: Record<string, unknown>
  body: string // raw markdown prose
  filePath: string
}

// ------------------------------------------------------------
// APP SETTINGS
// ------------------------------------------------------------

export interface AppSettings {
  llmConfig: LLMConfig
  defaultTemplateId: string
  vaultPath?: string // for local markdown vault (future desktop mode)
  theme: 'light' | 'dark' | 'system'
  exportFormat: 'pdf' | 'docx'
}
