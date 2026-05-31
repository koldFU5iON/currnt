import * as z from "zod"

// The shape the LLM fills from raw CV text. Plain module (no 'use server') so
// both extract.ts and tests can import it.
//
// Optional (not nullable) on purpose: a nullable field becomes a `[type, null]`
// union in the generated JSON schema, and some providers cap the number of
// union-typed parameters (Gemini: 16). Optional fields carry no union — the
// model simply omits what the CV doesn't contain, which also matches our
// "never fabricate" rule. Array constraints stay loose (no min/max): a
// slightly-off count must not cost a paid retry. Dates are strings here and
// become Dates later in date-parse.ts.

const ActivitySchema = z.object({
  kind: z.enum(["responsibility", "achievement"])
    .describe('"responsibility" = an ongoing duty or scope of work. "achievement" = a specific outcome or measurable result. When ambiguous, prefer responsibility.'),
  description: z.string().min(1)
    .describe("A single bullet describing the activity. Stands alone — no leading conjunctions or pronouns referring to other bullets."),
  impact: z.string().optional()
    .describe("Optional measurable outcome or numeric result lifted from the bullet (e.g. '40 → 5,000+ tracked projects'). Omit when none — never fabricate."),
})

const ExperienceSchema = z.object({
  company: z.string().min(1).describe("Employer name."),
  role: z.string().min(1).describe("Job title for this specific position."),
  startDate: z.string().optional()
    .describe('Start month as "YYYY-MM". Omit only if truly absent. NEVER use the company-level tenure total (e.g. "5 years 3 months") as a date.'),
  endDate: z.string().optional()
    .describe('End month as "YYYY-MM". Omit when the role is current ("Present").'),
  location: z.string().optional().describe("City/region for the role, if shown."),
  remote: z.boolean().describe("True only if the role is explicitly remote."),
  summary: z.string().optional().describe("The role's intro paragraph (prose above the bullets), if any."),
  activities: z.array(ActivitySchema),
})

const EducationSchema = z.object({
  institution: z.string().min(1),
  qualification: z.string().min(1).describe("Degree or programme name (e.g. 'Business Communications', 'Matriculated')."),
  field: z.string().optional().describe("Field of study, if distinct from the qualification."),
  startDate: z.string().optional().describe('Start year as "YYYY".'),
  endDate: z.string().optional().describe('End year as "YYYY".'),
})

const CertificationSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().optional().describe("Issuing organisation. Omit when the CV does not name one."),
  issueDate: z.string().optional().describe('Issue month as "YYYY-MM". Omit when no date is shown.'),
})

const SkillSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional().describe('Grouping label (e.g. "Marketing", "Engineering"). Omit when unclear.'),
})

const ContactSchema = z.object({
  name: z.string().optional(),
  headline: z.string().optional().describe("The tagline under the name (e.g. 'Senior Program Manager | ...')."),
  location: z.string().optional().describe("City/region line — NOT the street address."),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedIn: z.string().optional(),
  website: z.string().optional(),
  github: z.string().optional(),
})

export const ExtractedProfileSchema = z.object({
  contact: ContactSchema,
  summary: z.string().optional().describe("The free-text professional summary / about section."),
  experiences: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  certifications: z.array(CertificationSchema),
  skills: z.array(SkillSchema).describe('Includes any "Top Skills" section; ordering is not preserved.'),
})

export type ExtractedProfile = z.infer<typeof ExtractedProfileSchema>
export type ExtractedExperience = z.infer<typeof ExperienceSchema>
export type ExtractedActivity = z.infer<typeof ActivitySchema>

export const emptyExtractedProfile: ExtractedProfile = {
  contact: {},
  experiences: [],
  education: [],
  certifications: [],
  skills: [],
}
