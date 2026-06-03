import { z } from "zod"

export const HeaderDataSchema = z.object({
  name: z.string(),
  headline: z.string(),
  subHeadline: z.string().optional(),
  contact: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().optional(),
  }),
})

export const ProfileDataSchema = z.object({ content: z.string() })
export const CompetenciesDataSchema = z.object({ items: z.array(z.string()) })
export const CapabilitiesDataSchema = z.object({ items: z.array(z.string()) })

export const ExperienceDataSchema = z.object({
  company: z.string(),
  titles: z.array(z.string()),
  location: z.string(),
  duration: z.string(),
  description: z.string(),
  outcomes: z.array(z.string()),
})

export const EducationDataSchema = z.object({
  institution: z.string(),
  qualification: z.string(),
  field: z.string().optional(),
  duration: z.string(),
  grade: z.string().optional(),
})

export const CertificationDataSchema = z.object({
  name: z.string(),
  issuer: z.string().optional(),
  date: z.string().optional(),
  url: z.string().optional(),
})

export const SkillsDataSchema = z.object({ items: z.array(z.string()) })
export const ToolsDataSchema = z.object({ items: z.array(z.string()) })
export const LanguagesDataSchema = z.object({
  items: z.array(z.object({ name: z.string(), proficiency: z.string() })),
})

export const CVSectionSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("header"),        visible: z.boolean(), data: HeaderDataSchema }),
  z.object({ id: z.string(), type: z.literal("profile"),       visible: z.boolean(), data: ProfileDataSchema }),
  z.object({ id: z.string(), type: z.literal("competencies"),  visible: z.boolean(), data: CompetenciesDataSchema }),
  z.object({ id: z.string(), type: z.literal("capabilities"),  visible: z.boolean(), data: CapabilitiesDataSchema }),
  z.object({ id: z.string(), type: z.literal("experience"),    visible: z.boolean(), data: ExperienceDataSchema }),
  z.object({ id: z.string(), type: z.literal("education"),     visible: z.boolean(), data: EducationDataSchema }),
  z.object({ id: z.string(), type: z.literal("certification"), visible: z.boolean(), data: CertificationDataSchema }),
  z.object({ id: z.string(), type: z.literal("skills"),        visible: z.boolean(), data: SkillsDataSchema }),
  z.object({ id: z.string(), type: z.literal("tools"),         visible: z.boolean(), data: ToolsDataSchema }),
  z.object({ id: z.string(), type: z.literal("languages"),     visible: z.boolean(), data: LanguagesDataSchema }),
])

export const CVDocumentContentSchema = z.object({
  version: z.literal(1),
  sections: z.array(CVSectionSchema),
})

export type CVDocumentContent = z.infer<typeof CVDocumentContentSchema>
export type CVSection = z.infer<typeof CVSectionSchema>
export type HeaderData = z.infer<typeof HeaderDataSchema>
export type ExperienceData = z.infer<typeof ExperienceDataSchema>
export type EducationData = z.infer<typeof EducationDataSchema>
export type CertificationData = z.infer<typeof CertificationDataSchema>

export function parseCVContent(raw: string): CVDocumentContent {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed.version) return { version: 1, sections: [] }
    return CVDocumentContentSchema.parse(parsed)
  } catch {
    return { version: 1, sections: [] }
  }
}
