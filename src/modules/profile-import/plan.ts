import { normalize } from "@/modules/profile/duplicate-detect"
import { parseMonthYear, parseYear } from "./date-parse"
import type { ExtractedActivity, ExtractedProfile } from "./schema"

// The 8 contact columns that map 1:1 to ExtractedProfile.contact. `summary` is
// handled separately because it sits at the top level of ExtractedProfile, not
// under contact.
const CONTACT_FIELDS = ["name", "email", "phone", "location", "website", "linkedIn", "github", "headline"] as const
type ContactKey = (typeof CONTACT_FIELDS)[number]
type ContactUpdate = Partial<Record<ContactKey | "summary", string>>

export type ExistingProfileState = {
  contact: Record<ContactKey, string>     // current contact values, "" when empty
  summary: string                         // current summary, "" when empty
  experienceKeys: Set<string>             // normalized "company|role"
  skillKeys: Set<string>                  // normalized skill name
}

export type PlannedExperience = {
  company: string
  role: string
  startDate: Date
  endDate: Date | null
  location: string | null
  remote: boolean
  summary: string | null
  activities: ExtractedActivity[]
}

export type PlannedEducation = {
  institution: string
  qualification: string
  field: string | null
  startDate: Date
  endDate: Date | null
}

export type CommitPlan = {
  contactUpdate: ContactUpdate
  experiences: PlannedExperience[]
  education: PlannedEducation[]
  certifications: Array<{ name: string; issuer: string | null; issueDate: Date | null }>
  skills: Array<{ name: string; category: string; level: string }>
  skipped: Array<{ type: "experience" | "education"; label: string; reason: string }>
}

function expKey(company: string, role: string): string {
  return `${normalize(company)}|${normalize(role)}`
}

export function buildCommitPlan(extracted: ExtractedProfile, existing: ExistingProfileState): CommitPlan {
  const plan: CommitPlan = {
    contactUpdate: {},
    experiences: [],
    education: [],
    certifications: [],
    skills: [],
    skipped: [],
  }

  // Contact: fill a field only when extracted has a value AND existing is empty.
  for (const field of CONTACT_FIELDS) {
    const incoming = extracted.contact[field]
    const current = existing.contact[field] ?? ""
    if (incoming && incoming.trim() && !current.trim()) {
      plan.contactUpdate[field] = incoming.trim()
    }
  }
  // Summary lives at the top level of ExtractedProfile, not under contact.
  if (extracted.summary && extracted.summary.trim() && !existing.summary.trim()) {
    plan.contactUpdate.summary = extracted.summary.trim()
  }

  // Experiences: skip duplicates and entries with no parseable start date.
  for (const exp of extracted.experiences) {
    const label = `${exp.role} — ${exp.company}`
    if (existing.experienceKeys.has(expKey(exp.company, exp.role))) {
      plan.skipped.push({ type: "experience", label, reason: "duplicate" })
      continue
    }
    const startDate = parseMonthYear(exp.startDate)
    if (!startDate) {
      plan.skipped.push({ type: "experience", label, reason: "missing start date" })
      continue
    }
    plan.experiences.push({
      company: exp.company,
      role: exp.role,
      startDate,
      endDate: parseMonthYear(exp.endDate),
      location: exp.location,
      remote: exp.remote,
      summary: exp.summary,
      activities: exp.activities,
    })
  }

  // Education: skip entries with no parseable start year.
  for (const ed of extracted.education) {
    const startDate = parseYear(ed.startDate)
    if (!startDate) {
      plan.skipped.push({ type: "education", label: `${ed.qualification} — ${ed.institution}`, reason: "missing start year" })
      continue
    }
    plan.education.push({
      institution: ed.institution,
      qualification: ed.qualification,
      field: ed.field,
      startDate,
      endDate: parseYear(ed.endDate),
    })
  }

  // Certifications: issuer/issueDate are now nullable in the schema.
  for (const cert of extracted.certifications) {
    plan.certifications.push({ name: cert.name, issuer: cert.issuer, issueDate: parseMonthYear(cert.issueDate) })
  }

  // Skills: dedup against existing by normalized name; apply DB defaults.
  for (const skill of extracted.skills) {
    if (existing.skillKeys.has(normalize(skill.name))) continue
    plan.skills.push({ name: skill.name, category: skill.category ?? "General", level: "Intermediate" })
  }

  return plan
}
