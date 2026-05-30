"use server"

import { prisma } from "@/lib/db"
import { requireProfile } from "@/lib/session"
import { normalize } from "@/modules/profile/duplicate-detect"
import { revalidatePath } from "next/cache"
import { buildCommitPlan, type ExistingProfileState } from "./plan"
import type { ExtractedProfile } from "./schema"

export type CommitResult = {
  created: { experiences: number; education: number; certifications: number; skills: number; contactFields: number }
  skipped: Array<{ type: "experience" | "education"; label: string; reason: string }>
}

export async function commitImportedProfile(payload: ExtractedProfile): Promise<CommitResult> {
  const { profile } = await requireProfile()

  const row = await prisma.profile.findUniqueOrThrow({
    where: { id: profile.id },
    select: {
      name: true, email: true, phone: true, location: true, website: true,
      linkedIn: true, github: true, headline: true, summary: true,
      experiences: { select: { company: true, role: true } },
      skills: { select: { name: true } },
    },
  })

  const existing: ExistingProfileState = {
    contact: {
      name: row.name ?? "", email: row.email ?? "", phone: row.phone ?? "",
      location: row.location ?? "", website: row.website ?? "", linkedIn: row.linkedIn ?? "",
      github: row.github ?? "", headline: row.headline ?? "",
    },
    summary: row.summary ?? "",
    experienceKeys: new Set(row.experiences.map((e) => `${normalize(e.company)}|${normalize(e.role)}`)),
    skillKeys: new Set(row.skills.map((s) => normalize(s.name))),
  }

  const plan = buildCommitPlan(payload, existing)

  await prisma.$transaction([
    prisma.profile.update({ where: { id: profile.id }, data: plan.contactUpdate }),
    ...plan.experiences.map((e) =>
      prisma.experience.create({
        data: {
          profileId: profile.id,
          company: e.company,
          role: e.role,
          startDate: e.startDate,
          endDate: e.endDate ?? undefined,
          location: e.location ?? undefined,
          remote: e.remote,
          summary: e.summary ?? "",
          tags: "[]",
          activities: {
            create: e.activities.map((a, i) => ({
              kind: a.kind,
              description: a.description,
              impact: a.impact ?? undefined,
              tags: "[]",
              order: i,
            })),
          },
        },
      }),
    ),
    ...plan.education.map((ed) =>
      prisma.education.create({
        data: {
          profileId: profile.id,
          institution: ed.institution,
          qualification: ed.qualification,
          field: ed.field ?? undefined,
          startDate: ed.startDate,
          endDate: ed.endDate ?? undefined,
          tags: "[]",
        },
      }),
    ),
    ...plan.certifications.map((c) =>
      prisma.certification.create({
        data: {
          profileId: profile.id,
          name: c.name,
          issuer: c.issuer ?? undefined,
          issueDate: c.issueDate ?? undefined,
          tags: "[]",
        },
      }),
    ),
    ...plan.skills.map((s) =>
      prisma.skill.create({
        data: { profileId: profile.id, name: s.name, category: s.category, level: s.level, tags: "[]" },
      }),
    ),
  ])

  revalidatePath("/dashboard/profile")

  return {
    created: {
      experiences: plan.experiences.length,
      education: plan.education.length,
      certifications: plan.certifications.length,
      skills: plan.skills.length,
      contactFields: Object.keys(plan.contactUpdate).length,
    },
    skipped: plan.skipped,
  }
}
