# CV Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a job-tailored CV builder that generates a structured JSON document from the user's profile + job description, renders it as an inline block editor, and exports to PDF/Markdown/text.

**Architecture:** The CV document is stored as `CVDocumentContent` JSON in `CVDocument.generatedContent`. Each section is a typed block with `{ id, type, visible, data }`. The LLM generates the entire document in one shot via `completeStructured`. The editor renders each block with inline edit/hide/copy controls. Entry points live in the job applications list via `AppControls` and a CV icon in the job row title cell.

**Tech Stack:** Next.js 16 App Router, Prisma 7, Zod, `react-markdown` (already installed), Tailwind CSS, shadcn/ui, Lucide icons.

---

## File Structure

**Create:**
- `src/modules/cv/schema.ts` — Zod schemas + types + `parseCVContent`
- `src/modules/cv/schema.test.ts`
- `src/modules/cv/export.ts` — `toMarkdown`, `toText`, `sectionToPlainText`
- `src/modules/cv/export.test.ts`
- `src/modules/cv/queries.ts` — `getCV`, `listCVs`
- `src/modules/cv/actions.ts` — `createAndGenerateCV`, `updateSection`, `toggleVisibility`, `deleteCV`
- `src/modules/cv/generate.ts` — LLM generation
- `src/lib/prompts/cv-generate.md` — system prompt for CV generation
- `src/app/dashboard/cv-builder/page.tsx` — list all CVs
- `src/app/dashboard/cv-builder/new/page.tsx` — generation trigger (client component)
- `src/app/dashboard/cv-builder/[id]/page.tsx` — editor page (server component)
- `src/app/dashboard/cv-builder/[id]/_components/cv-editor.tsx` — editor shell (client)
- `src/app/dashboard/cv-builder/[id]/_components/cv-block.tsx` — block wrapper
- `src/app/dashboard/cv-builder/[id]/_components/section-rail.tsx` — right rail
- `src/app/dashboard/cv-builder/[id]/_components/blocks/header-block.tsx`
- `src/app/dashboard/cv-builder/[id]/_components/blocks/profile-block.tsx`
- `src/app/dashboard/cv-builder/[id]/_components/blocks/competencies-block.tsx`
- `src/app/dashboard/cv-builder/[id]/_components/blocks/capabilities-block.tsx`
- `src/app/dashboard/cv-builder/[id]/_components/blocks/experience-block.tsx`
- `src/app/dashboard/cv-builder/[id]/_components/blocks/education-block.tsx`
- `src/app/dashboard/cv-builder/[id]/_components/blocks/certification-block.tsx`
- `src/app/dashboard/cv-builder/[id]/_components/blocks/skills-block.tsx`
- `src/app/dashboard/cv-builder/[id]/_components/blocks/tools-block.tsx`
- `src/app/dashboard/cv-builder/[id]/_components/blocks/languages-block.tsx`

**Modify:**
- `src/modules/llm/prompt-context.ts` — add `loadCVPrompt()`
- `src/app/types/job-application.ts` — add `cvDocumentId?: string | null` to `Job`
- `src/modules/jobs/queries.ts` — include `cvDocuments` in `getActiveJobs` + `getArchivedJobs`
- `src/components/app-item-menu.tsx` — add Generate CV / View CV item + `cvDocumentId` prop
- `src/app/dashboard/job-applications/_components/job-row.tsx` — add CV icon + pass `cvDocumentId`
- `src/lib/nav-menu.ts` — add CV Builder nav item
- `src/app/dashboard/settings/usage/_components/usage-log.tsx` — add `'cv-generate'` label

---

## Task 1: Zod Schema

**Files:**
- Create: `src/modules/cv/schema.ts`
- Create: `src/modules/cv/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/cv/schema.test.ts
import { describe, expect, it } from "vitest"
import { CVDocumentContentSchema, parseCVContent } from "./schema"

const headerSection = {
  id: "header",
  type: "header" as const,
  visible: true,
  data: { name: "Devon", headline: "Senior PM", contact: {} },
}

describe("CVDocumentContentSchema", () => {
  it("parses a minimal valid document", () => {
    const doc = { version: 1, sections: [] }
    expect(CVDocumentContentSchema.parse(doc)).toEqual(doc)
  })

  it("parses a document with a header section", () => {
    const doc = { version: 1, sections: [headerSection] }
    expect(CVDocumentContentSchema.parse(doc).sections).toHaveLength(1)
  })

  it("header subHeadline is optional", () => {
    const doc = { version: 1, sections: [headerSection] }
    expect(() => CVDocumentContentSchema.parse(doc)).not.toThrow()
  })

  it("rejects an unknown section type", () => {
    const bad = { version: 1, sections: [{ id: "x", type: "unknown", visible: true, data: {} }] }
    expect(() => CVDocumentContentSchema.parse(bad)).toThrow()
  })

  it("parses an experience section with multiple titles", () => {
    const doc = {
      version: 1,
      sections: [{
        id: "e1", type: "experience", visible: true,
        data: { company: "Unity", titles: ["Senior PM", "PM"], location: "Remote", duration: "2019–2023", description: "Led delivery.", outcomes: ["40% faster"] },
      }],
    }
    expect(CVDocumentContentSchema.parse(doc).sections[0].type).toBe("experience")
  })
})

describe("parseCVContent", () => {
  it("returns empty doc for empty object string", () => {
    expect(parseCVContent("{}")).toEqual({ version: 1, sections: [] })
  })

  it("returns empty doc for invalid JSON", () => {
    expect(parseCVContent("not-json")).toEqual({ version: 1, sections: [] })
  })

  it("parses a valid serialised document", () => {
    const doc = { version: 1, sections: [headerSection] }
    expect(parseCVContent(JSON.stringify(doc)).sections).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- src/modules/cv/schema.test.ts
```
Expected: error — module not found.

- [ ] **Step 3: Write the schema**

```ts
// src/modules/cv/schema.ts
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- src/modules/cv/schema.test.ts
```
Expected: all pass.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/cv/schema.ts src/modules/cv/schema.test.ts
git commit -m "feat(cv): add CVDocumentContent Zod schema"
```

---

## Task 2: Export Utilities

**Files:**
- Create: `src/modules/cv/export.ts`
- Create: `src/modules/cv/export.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/cv/export.test.ts
import { describe, expect, it } from "vitest"
import { toMarkdown, toText, sectionToPlainText } from "./export"
import type { CVDocumentContent, CVSection } from "./schema"

const doc: CVDocumentContent = {
  version: 1,
  sections: [
    {
      id: "h", type: "header", visible: true,
      data: { name: "Devon Stanton", headline: "Senior PM", contact: { email: "d@d.com", phone: "+44 7700" } },
    },
    {
      id: "p", type: "profile", visible: true,
      data: { content: "**Experienced** PM with 15+ years." },
    },
    {
      id: "e1", type: "experience", visible: true,
      data: { company: "Unity", titles: ["Senior PM", "PM"], location: "Remote", duration: "2019–2023", description: "Led delivery.", outcomes: ["40% faster cycles", "Saved $2M"] },
    },
    {
      id: "lang", type: "languages", visible: false,
      data: { items: [{ name: "English", proficiency: "native" }] },
    },
  ],
}

describe("toMarkdown", () => {
  it("includes name from header", () => {
    expect(toMarkdown(doc)).toContain("Devon Stanton")
  })

  it("includes experience company", () => {
    expect(toMarkdown(doc)).toContain("Unity")
  })

  it("includes promotion chain in titles", () => {
    expect(toMarkdown(doc)).toContain("Senior PM → PM")
  })

  it("prefixes outcomes with arrow", () => {
    expect(toMarkdown(doc)).toContain("→ 40% faster cycles")
  })

  it("excludes hidden sections", () => {
    expect(toMarkdown(doc)).not.toContain("English")
  })
})

describe("toText", () => {
  it("strips markdown bold markers", () => {
    const text = toText(doc)
    expect(text).not.toContain("**")
    expect(text).toContain("Experienced PM")
  })
})

describe("sectionToPlainText", () => {
  it("serialises a competencies section", () => {
    const section: CVSection = {
      id: "c", type: "competencies", visible: true,
      data: { items: ["Stakeholder management", "Risk governance"] },
    }
    const text = sectionToPlainText(section)
    expect(text).toContain("Stakeholder management")
    expect(text).toContain("Risk governance")
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- src/modules/cv/export.test.ts
```
Expected: error — module not found.

- [ ] **Step 3: Write the export module**

```ts
// src/modules/cv/export.ts
import type { CVDocumentContent, CVSection } from "./schema"

export function toMarkdown(doc: CVDocumentContent): string {
  return doc.sections
    .filter(s => s.visible)
    .map(sectionToMarkdown)
    .filter(Boolean)
    .join("\n\n")
}

export function toText(doc: CVDocumentContent): string {
  return toMarkdown(doc).replace(/[*_`#]/g, "")
}

export function sectionToPlainText(section: CVSection): string {
  return sectionToMarkdown(section).replace(/[*_`#]/g, "")
}

function sectionToMarkdown(section: CVSection): string {
  switch (section.type) {
    case "header": {
      const { name, headline, subHeadline, contact } = section.data
      const contactLine = [contact.email, contact.phone, contact.linkedin, contact.website]
        .filter(Boolean).join(" · ")
      return [
        `# ${name}`,
        headline,
        subHeadline,
        contactLine,
      ].filter(Boolean).join("\n")
    }
    case "profile":
      return `## Professional Profile\n\n${section.data.content}`
    case "competencies":
      return `## Core Competencies\n\n${section.data.items.map(i => `- ${i}`).join("\n")}`
    case "capabilities":
      return `## Capabilities\n\n${section.data.items.map(i => `- ${i}`).join("\n")}`
    case "experience": {
      const { company, titles, location, duration, description, outcomes } = section.data
      return [
        `### ${company}`,
        `_${titles.join(" → ")}_`,
        `${location} · ${duration}`,
        "",
        description,
        "",
        ...outcomes.map(o => `→ ${o}`),
      ].join("\n")
    }
    case "education": {
      const { institution, qualification, field, duration, grade } = section.data
      return [
        `### ${institution}`,
        `${qualification}${field ? ` · ${field}` : ""}`,
        `${duration}${grade ? ` · ${grade}` : ""}`,
      ].join("\n")
    }
    case "certification": {
      const { name, issuer, date } = section.data
      return `- **${name}**${issuer ? ` — ${issuer}` : ""}${date ? ` (${date})` : ""}`
    }
    case "skills":
      return `## Skills\n\n${section.data.items.join(", ")}`
    case "tools":
      return `## Tools\n\n${section.data.items.join(", ")}`
    case "languages":
      return `## Languages\n\n${section.data.items.map(l => `${l.name} (${l.proficiency})`).join(", ")}`
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- src/modules/cv/export.test.ts
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/cv/export.ts src/modules/cv/export.test.ts
git commit -m "feat(cv): add toMarkdown/toText export utilities"
```

---

## Task 3: Prompt File + Feature Label + Loader

**Files:**
- Create: `src/lib/prompts/cv-generate.md`
- Modify: `src/modules/llm/prompt-context.ts` — add `loadCVPrompt()`
- Modify: `src/app/dashboard/settings/usage/_components/usage-log.tsx` — add feature label

- [ ] **Step 1: Create the CV generation prompt**

```markdown
<!-- src/lib/prompts/cv-generate.md -->
# CV Generation

You are an expert CV writer. Your job is to tailor the candidate's real experience toward a target job description and produce a structured JSON document.

## Rules
- Never invent experience, skills, or outcomes not present in the provided profile data
- Weave in keywords from the job description naturally — do not keyword-stuff
- Use Markdown (bold, italic) sparingly for emphasis in prose fields — not in list items
- Order experiences most-recent first
- Omit a section entirely if the profile has no relevant data for it
- Achievement bullets must lead with an action verb

## Transferable skills
Where the candidate's direct experience does not map exactly to the job description, surface transferable skills and adjacent experience that demonstrate relevant capability. Be explicit — name the transferable skill and briefly connect it to the requirement. Only make connections that are genuinely defensible from the profile data.

## Generic CV mode
When no job description is provided, produce a comprehensive best-foot-forward CV. Include all significant experiences. Highlight breadth and depth of capability rather than optimising for a specific role.

## Output contract
Return a valid CVDocumentContent JSON object. The schema is:
- version: always 1
- sections: array of typed blocks, each with { id, type, visible: true, data }
- Section types and their data shapes are provided in the user message
- Use short kebab-case ids (e.g. "header", "profile", "exp-unity-2019", "edu-1")
- All sections default to visible: true — let the user hide sections they don't need
```

- [ ] **Step 2: Add `loadCVPrompt` to prompt-context.ts**

Open `src/modules/llm/prompt-context.ts`. Add after the `loadWritingRules` function:

```ts
export async function loadCVPrompt(): Promise<string> {
  const promptPath = path.join(process.cwd(), 'src/lib/prompts/cv-generate.md')
  return readFile(promptPath, 'utf-8').catch(() => {
    throw new Error('cv-generate.md missing from bundle — check outputFileTracingIncludes in next.config.ts')
  })
}
```

The existing `import { readFile }` and `import path` are already at the top of that file — no new imports needed.

- [ ] **Step 3: Add feature label to usage-log.tsx**

Open `src/app/dashboard/settings/usage/_components/usage-log.tsx`. Find `FEATURE_LABELS` and add one entry:

```ts
const FEATURE_LABELS: Record<string, string> = {
  'job-fit': 'Job fit',
  'job-extract': 'Job extract',
  'cv-import': 'CV import',
  'profile-summary': 'Profile summary',
  'profile-extract': 'Profile extract',
  'cv-generate': 'CV generation',   // ← add this line
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts/cv-generate.md src/modules/llm/prompt-context.ts src/app/dashboard/settings/usage/_components/usage-log.tsx
git commit -m "feat(cv): add cv-generate prompt, loader, and feature label"
```

---

## Task 4: Generate Module

**Files:**
- Create: `src/modules/cv/generate.ts`

- [ ] **Step 1: Read the profile snapshot module**

Before writing, open and read `src/modules/profile/snapshot.ts` to understand `buildProfileSnapshot` and `serializeProfileForLLM`. Also confirm `completeStructured` export in `src/modules/llm/client.ts`. These are the two functions this module depends on.

- [ ] **Step 2: Write generate.ts**

```ts
// src/modules/cv/generate.ts
import { prisma } from '@/lib/db'
import { completeStructured } from '@/modules/llm/client'
import { loadWritingContext, loadCVPrompt, composeSystem } from '@/modules/llm/prompt-context'
import { buildProfileSnapshot, serializeProfileForLLM } from '@/modules/profile/snapshot'
import { CVDocumentContentSchema, type CVDocumentContent } from './schema'

const SCHEMA_HINT = `
Section types and their data shapes:
- header:        { name, headline, subHeadline?, contact: { email?, phone?, linkedin?, website? } }
- profile:       { content }  -- prose, Markdown allowed
- competencies:  { items: string[] }
- capabilities:  { items: string[] }
- experience:    { company, titles: string[], location, duration, description, outcomes: string[] }
- education:     { institution, qualification, field?, duration, grade? }
- certification: { name, issuer?, date?, url? }
- skills:        { items: string[] }
- tools:         { items: string[] }
- languages:     { items: [{ name, proficiency }] }
`

export async function generateCVContent(
  profileId: string,
  jobApplicationId?: string,
): Promise<CVDocumentContent> {
  const [snapshot, { rules, brief }, cvPrompt, jobApp] = await Promise.all([
    buildProfileSnapshot(profileId),
    loadWritingContext(profileId),
    loadCVPrompt(),
    jobApplicationId
      ? prisma.jobApplication.findFirst({
          where: { id: jobApplicationId, profileId },
          select: { jobDescription: true, title: true, company: true },
        })
      : Promise.resolve(null),
  ])

  const jobContext = jobApp?.jobDescription
    ? `== JOB TARGET ==\nRole: ${jobApp.title} at ${jobApp.company}\n\n${jobApp.jobDescription}`
    : `== MODE: GENERIC CV ==\nNo specific job target. Include all significant experience.`

  const userMessage = [
    jobContext,
    '',
    '== CANDIDATE PROFILE ==',
    serializeProfileForLLM(snapshot),
    '',
    '== OUTPUT SCHEMA ==',
    SCHEMA_HINT,
  ].join('\n')

  return completeStructured(
    profileId,
    userMessage,
    CVDocumentContentSchema,
    {
      system: composeSystem(rules, brief, cvPrompt),
      feature: 'cv-generate',
      maxOutputTokens: 4000,
      temperature: 0.3,
    },
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors. If `completeStructured` is not exported from `@/modules/llm/client`, check `@/modules/llm/actions` and update the import.

- [ ] **Step 4: Commit**

```bash
git add src/modules/cv/generate.ts
git commit -m "feat(cv): add LLM generation module"
```

---

## Task 5: Queries

**Files:**
- Create: `src/modules/cv/queries.ts`

- [ ] **Step 1: Write queries.ts**

```ts
// src/modules/cv/queries.ts
import { prisma } from '@/lib/db'
import { parseCVContent } from './schema'

export async function getCV(id: string, profileId: string) {
  const doc = await prisma.cVDocument.findFirst({
    where: { id, profileId },
    include: {
      jobApplication: {
        select: { id: true, title: true, company: true, jobDescription: true },
      },
    },
  })
  if (!doc) return null
  return { ...doc, content: parseCVContent(doc.generatedContent) }
}

export async function listCVs(profileId: string) {
  return prisma.cVDocument.findMany({
    where: { profileId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      status: true,
      jobTitle: true,
      company: true,
      jobApplicationId: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/cv/queries.ts
git commit -m "feat(cv): add CV queries"
```

---

## Task 6: Actions

**Files:**
- Create: `src/modules/cv/actions.ts`

- [ ] **Step 1: Write actions.ts**

```ts
// src/modules/cv/actions.ts
'use server'

import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { parseCVContent, type CVSection } from './schema'
import { generateCVContent } from './generate'

export async function createAndGenerateCV({
  jobApplicationId,
}: {
  jobApplicationId?: string
}): Promise<{ id: string }> {
  const { profile } = await requireProfile()

  // If a CV already exists for this job, return it without regenerating
  if (jobApplicationId) {
    const existing = await prisma.cVDocument.findFirst({
      where: { profileId: profile.id, jobApplicationId },
      select: { id: true },
    })
    if (existing) return { id: existing.id }
  }

  const template = await prisma.cVTemplate.findFirst({
    where: { isDefault: true },
    select: { id: true },
  })
  if (!template) throw new Error('No default CV template found. Run npm run db:seed.')

  const doc = await prisma.cVDocument.create({
    data: {
      profileId: profile.id,
      jobApplicationId: jobApplicationId ?? null,
      templateId: template.id,
      generatedContent: '{}',
      status: 'generating',
    },
  })

  const content = await generateCVContent(profile.id, jobApplicationId)

  await prisma.cVDocument.update({
    where: { id: doc.id },
    data: { generatedContent: JSON.stringify(content), status: 'draft' },
  })

  return { id: doc.id }
}

export async function updateSection(cvId: string, section: CVSection): Promise<void> {
  const { profile } = await requireProfile()
  const doc = await prisma.cVDocument.findFirst({
    where: { id: cvId, profileId: profile.id },
    select: { id: true, generatedContent: true },
  })
  if (!doc) throw new Error('CV not found')

  const content = parseCVContent(doc.generatedContent)
  const idx = content.sections.findIndex(s => s.id === section.id)
  if (idx === -1) throw new Error('Section not found')
  content.sections[idx] = section

  await prisma.cVDocument.update({
    where: { id: cvId },
    data: { generatedContent: JSON.stringify(content) },
  })
  revalidatePath(`/dashboard/cv-builder/${cvId}`)
}

export async function toggleVisibility(cvId: string, sectionId: string): Promise<void> {
  const { profile } = await requireProfile()
  const doc = await prisma.cVDocument.findFirst({
    where: { id: cvId, profileId: profile.id },
    select: { id: true, generatedContent: true },
  })
  if (!doc) throw new Error('CV not found')

  const content = parseCVContent(doc.generatedContent)
  const section = content.sections.find(s => s.id === sectionId)
  if (!section) throw new Error('Section not found')
  section.visible = !section.visible

  await prisma.cVDocument.update({
    where: { id: cvId },
    data: { generatedContent: JSON.stringify(content) },
  })
  revalidatePath(`/dashboard/cv-builder/${cvId}`)
}

export async function deleteCV(cvId: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.cVDocument.deleteMany({ where: { id: cvId, profileId: profile.id } })
  revalidatePath('/dashboard/cv-builder')
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/cv/actions.ts
git commit -m "feat(cv): add CV server actions"
```

---

## Task 7: Job List Data Layer

**Files:**
- Modify: `src/app/types/job-application.ts`
- Modify: `src/modules/jobs/queries.ts`

- [ ] **Step 1: Add cvDocumentId to the Job type**

Open `src/app/types/job-application.ts`. Find the `Job` type and add the new field:

```ts
export type Job = Omit<JobApplication, "status" | "progress" | "jobFit" | "applicationSource"> & {
  status: ApplicationStatusType
  progress: ApplicationProgressType
  jobFit?: JobFit | null
  applicationSource: ApplicationSourceType
  cvDocumentId?: string | null   // ← add this line
}
```

- [ ] **Step 2: Include cvDocuments in getActiveJobs**

Open `src/modules/jobs/queries.ts`. Replace the `getActiveJobs` function body:

```ts
export async function getActiveJobs(): Promise<Job[]> {
  const { profile } = await requireProfile()
  const jobs = await prisma.jobApplication.findMany({
    where: { profileId: profile.id, archivedAt: null },
    orderBy: [{ dateApplied: { sort: 'desc', nulls: 'last' } }, { lastUpdated: 'desc' }],
    include: {
      cvDocuments: {
        select: { id: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  return jobs.map(j => ({
    ...j,
    cvDocumentId: j.cvDocuments[0]?.id ?? null,
  })) as Job[]
}
```

- [ ] **Step 3: Include cvDocuments in getArchivedJobs**

Replace the `getArchivedJobs` function body:

```ts
export async function getArchivedJobs(): Promise<Job[]> {
  const { profile } = await requireProfile()
  const jobs = await prisma.jobApplication.findMany({
    where: { profileId: profile.id, archivedAt: { not: null } },
    orderBy: [{ archivedAt: 'desc' }],
    include: {
      cvDocuments: {
        select: { id: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  return jobs.map(j => ({
    ...j,
    cvDocumentId: j.cvDocuments[0]?.id ?? null,
  })) as Job[]
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/types/job-application.ts src/modules/jobs/queries.ts
git commit -m "feat(cv): add cvDocumentId to Job type and queries"
```

---

## Task 8: Job List UI

**Files:**
- Modify: `src/components/app-item-menu.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-row.tsx`

- [ ] **Step 1: Add Generate CV / View CV to AppControls**

Open `src/components/app-item-menu.tsx`. Add `FileText` to the lucide import and add `cvDocumentId` to props:

```ts
import {
  Archive,
  FileText,   // ← add
  FilePlus,
  Inspect,
  LucideIcon,
  MoreHorizontal,
  Pencil,
  Trash
} from "lucide-react"

type AppControlsProps = {
  id: string
  cvDocumentId?: string | null   // ← add
  onEdit?: () => void
  onArchive?: () => void
}

export function AppControls({ id, cvDocumentId, onEdit, onArchive }: AppControlsProps) {
```

Inside the `File Management` `DropdownMenuGroup`, replace the disabled `FilePlus` item with:

```tsx
{cvDocumentId ? (
  <AppControlsItem
    Icon={FileText}
    label="View CV"
    action={`/dashboard/cv-builder/${cvDocumentId}`}
    shortcut="⌘D"
  />
) : (
  <AppControlsItem
    Icon={FileText}
    label="Generate CV"
    action={`/dashboard/cv-builder/new?jobId=${id}`}
    shortcut="⌘D"
  />
)}
<AppControlsItem
  Icon={FilePlus}
  label="Add File"
  disabled
  shortcut="⌘F"
/>
```

- [ ] **Step 2: Add CV icon and cvDocumentId prop to job-row.tsx**

Open `src/app/dashboard/job-applications/_components/job-row.tsx`. Add `FileText` to imports:

```ts
import { Loader2, FileText, SquareArrowOutUpRight } from "lucide-react"
```

Add `cvDocumentId` to `JobRowProps`:

```ts
type JobRowProps = {
  job: Job
  selected: boolean
  busyLabel?: string
  onToggleSelect: (id: string) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  hasLLMKey: boolean
}
```

In the component body, destructure `cvDocumentId`:

```ts
const {
  id, jobNumber, title, company, countries, url,
  dateApplied, datePublished, lastUpdated, status, progress,
  jobFit, notes, notesIncludeInFit, applicationSource,
  jobDescription, salaryBand, cvDocumentId,   // ← add
} = job
```

In the title cell, add the CV icon after the external link icon:

```tsx
{cvDocumentId && (
  <Link
    href={`/dashboard/cv-builder/${cvDocumentId}`}
    aria-label="View CV"
    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
  >
    <FileText size={12} />
  </Link>
)}
```

Pass `cvDocumentId` to `AppControls`:

```tsx
<AppControls
  id={id}
  cvDocumentId={cvDocumentId}
  onEdit={() => onEdit(job)}
  onArchive={() => onArchive(id)}
/>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/app-item-menu.tsx src/app/dashboard/job-applications/_components/job-row.tsx
git commit -m "feat(cv): add CV entry points to job list row and controls"
```

---

## Task 9: Nav + CV Builder List Page

**Files:**
- Modify: `src/lib/nav-menu.ts`
- Create: `src/app/dashboard/cv-builder/page.tsx`

- [ ] **Step 1: Add CV Builder to nav**

Open `src/lib/nav-menu.ts`. Add `FileText` to the lucide import and add a nav item:

```ts
import {
  ClipboardList,
  Compass,
  FileText,   // ← add
  HomeIcon,
  UserRound,
  type LucideIcon
} from "lucide-react"

export const mainNav: NavItem[] = [
  { destination: "/dashboard",                  label: "Home",                Icon: HomeIcon },
  { destination: "/dashboard/job-applications", label: "Job Applications",    Icon: ClipboardList },
  { destination: "/dashboard/profile",          label: "Professional Profile", Icon: UserRound },
  { destination: "/dashboard/cv-builder",       label: "CV Builder",          Icon: FileText },   // ← add
  { destination: "/dashboard/onboarding",       label: "Search Context",      Icon: Compass },
]
```

- [ ] **Step 2: Create the CV list page**

```tsx
// src/app/dashboard/cv-builder/page.tsx
import Link from "next/link"
import { requireProfile } from "@/lib/session"
import { listCVs } from "@/modules/cv/queries"
import { ContentContainer } from "@/app/components/ContentContainer"
import { Button } from "@/components/ui/button"
import { FileText, Plus } from "lucide-react"
import { formatDate } from "@/lib/utils"

export default async function CVBuilderPage() {
  const { profile } = await requireProfile()
  const cvs = await listCVs(profile.id)

  return (
    <ContentContainer
      title="CV Builder"
      description="Create and manage your CVs. Generate a tailored CV from any job application, or build a master CV to share with recruiters."
    >
      <div className="mb-4 flex justify-end">
        <Button asChild size="sm">
          <Link href="/dashboard/cv-builder/new">
            <Plus className="mr-1.5 size-4" />
            New CV
          </Link>
        </Button>
      </div>

      {cvs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No CVs yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate a tailored CV from a job application, or create a master CV.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {cvs.map(cv => (
            <Link
              key={cv.id}
              href={`/dashboard/cv-builder/${cv.id}`}
              className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <FileText className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {cv.jobTitle && cv.company
                      ? `${cv.jobTitle} · ${cv.company}`
                      : "Master CV"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cv.jobApplicationId ? "Job-specific" : "Generic"} · Updated {formatDate(cv.updatedAt)}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                {cv.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </ContentContainer>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```
Open `http://localhost:3000/dashboard/cv-builder`. Verify: CV Builder appears in the sidebar nav, the page loads with the empty state.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav-menu.ts src/app/dashboard/cv-builder/page.tsx
git commit -m "feat(cv): add CV builder nav item and list page"
```

---

## Task 10: New / Generation Trigger Page

**Files:**
- Create: `src/app/dashboard/cv-builder/new/page.tsx`

- [ ] **Step 1: Create the generation page**

This client component fires `createAndGenerateCV` on mount and redirects when done. It shows a spinner during the LLM call (10–30 seconds is typical).

```tsx
// src/app/dashboard/cv-builder/new/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createAndGenerateCV } from '@/modules/cv/actions'
import { Loader2 } from 'lucide-react'

export default function NewCVPage() {
  const router = useRouter()
  const params = useSearchParams()
  const jobId = params.get('jobId') ?? undefined
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    createAndGenerateCV({ jobApplicationId: jobId })
      .then(({ id }) => router.replace(`/dashboard/cv-builder/${id}`))
      .catch(err => setError(err instanceof Error ? err.message : 'Generation failed'))
  }, []) // intentionally empty — runs once on mount

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-muted-foreground underline"
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <p className="text-sm font-medium">
        {jobId ? 'Tailoring your CV to the job description…' : 'Building your master CV…'}
      </p>
      <p className="text-xs text-muted-foreground">This takes about 15–30 seconds</p>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```
Navigate to `http://localhost:3000/dashboard/cv-builder/new`. Verify the spinner appears. If you have a job with a job description in the DB, try `/dashboard/cv-builder/new?jobId=<id>` — it should generate and redirect. You'll need an LLM key configured in Settings → LLM for this to work.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/cv-builder/new/page.tsx
git commit -m "feat(cv): add CV generation trigger page"
```

---

## Task 11: Editor Page + Shell

**Files:**
- Create: `src/app/dashboard/cv-builder/[id]/page.tsx`
- Create: `src/app/dashboard/cv-builder/[id]/_components/cv-editor.tsx`

- [ ] **Step 1: Create the editor server page**

```tsx
// src/app/dashboard/cv-builder/[id]/page.tsx
import { notFound } from "next/navigation"
import { requireProfile } from "@/lib/session"
import { getCV } from "@/modules/cv/queries"
import { CvEditor } from "./_components/cv-editor"

type Props = { params: Promise<{ id: string }> }

export default async function CVEditorPage({ params }: Props) {
  const { id } = await params
  const { profile } = await requireProfile()
  const cv = await getCV(id, profile.id)
  if (!cv) notFound()

  return <CvEditor cv={cv} />
}
```

- [ ] **Step 2: Create the editor shell (client component)**

```tsx
// src/app/dashboard/cv-builder/[id]/_components/cv-editor.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Download, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createAndGenerateCV, updateSection, toggleVisibility } from '@/modules/cv/actions'
import { toMarkdown, toText, sectionToPlainText } from '@/modules/cv/export'
import { SectionRail } from './section-rail'
import { CvBlock } from './cv-block'
import { HeaderBlock } from './blocks/header-block'
import { ProfileBlock } from './blocks/profile-block'
import { CompetenciesBlock } from './blocks/competencies-block'
import { CapabilitiesBlock } from './blocks/capabilities-block'
import { ExperienceBlock } from './blocks/experience-block'
import { EducationBlock } from './blocks/education-block'
import { CertificationBlock } from './blocks/certification-block'
import { SkillsBlock } from './blocks/skills-block'
import { ToolsBlock } from './blocks/tools-block'
import { LanguagesBlock } from './blocks/languages-block'
import type { CVDocumentContent, CVSection } from '@/modules/cv/schema'

type CVWithMeta = {
  id: string
  status: string
  jobTitle: string | null
  company: string | null
  jobApplicationId: string | null
  content: CVDocumentContent
}

type Props = { cv: CVWithMeta }

export function CvEditor({ cv }: Props) {
  const router = useRouter()
  const [content, setContent] = useState<CVDocumentContent>(cv.content)
  const [isPending, startTransition] = useTransition()

  const title = cv.jobTitle && cv.company
    ? `${cv.jobTitle} · ${cv.company}`
    : 'Master CV'

  function handleUpdateSection(section: CVSection) {
    setContent(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === section.id ? section : s),
    }))
    startTransition(() => updateSection(cv.id, section))
  }

  function handleToggleVisibility(sectionId: string) {
    setContent(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId ? { ...s, visible: !s.visible } : s
      ),
    }))
    startTransition(() => toggleVisibility(cv.id, sectionId))
  }

  function handleCopySection(section: CVSection) {
    navigator.clipboard.writeText(sectionToPlainText(section))
  }

  function handleRegenerate() {
    if (!confirm('This will overwrite your current edits. Continue?')) return
    startTransition(async () => {
      await createAndGenerateCV({ jobApplicationId: cv.jobApplicationId ?? undefined })
      router.refresh()
    })
  }

  function downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <Badge variant="outline" className="text-xs capitalize">{cv.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={isPending}>
            <RotateCcw className="mr-1.5 size-3.5" />
            Regenerate
          </Button>
          <div className="relative group">
            <Button variant="ghost" size="sm">
              <Download className="mr-1.5 size-3.5" />
              Export
            </Button>
            <div className="absolute right-0 top-full z-10 hidden w-40 rounded-md border border-border bg-background py-1 shadow-md group-hover:block">
              <button
                onClick={() => window.print()}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
              >
                Download PDF
              </button>
              <button
                onClick={() => downloadFile(toMarkdown(content), `${slug}.md`, 'text/markdown')}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
              >
                Download Markdown
              </button>
              <button
                onClick={() => downloadFile(toText(content), `${slug}.txt`, 'text/plain')}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
              >
                Download Text
              </button>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled title="Coming soon">
            <MessageSquare className="mr-1.5 size-3.5" />
            Discuss
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* CV Document */}
        <div className="flex-1 overflow-y-auto bg-muted/30 p-6 print:bg-white print:p-0">
          <div className="mx-auto max-w-2xl rounded-lg bg-background shadow-sm print:max-w-none print:shadow-none">
            {content.sections.map(section => (
              <CvBlock
                key={section.id}
                section={section}
                onToggleVisibility={() => handleToggleVisibility(section.id)}
                onCopy={() => handleCopySection(section)}
              >
                {renderBlock(section, handleUpdateSection)}
              </CvBlock>
            ))}
          </div>
        </div>

        {/* Right rail */}
        <SectionRail
          sections={content.sections}
          onToggleVisibility={handleToggleVisibility}
        />
      </div>
    </div>
  )
}

function renderBlock(section: CVSection, onUpdate: (s: CVSection) => void) {
  switch (section.type) {
    case 'header':        return <HeaderBlock section={section} onUpdate={onUpdate} />
    case 'profile':       return <ProfileBlock section={section} onUpdate={onUpdate} />
    case 'competencies':  return <CompetenciesBlock section={section} onUpdate={onUpdate} />
    case 'capabilities':  return <CapabilitiesBlock section={section} onUpdate={onUpdate} />
    case 'experience':    return <ExperienceBlock section={section} onUpdate={onUpdate} />
    case 'education':     return <EducationBlock section={section} onUpdate={onUpdate} />
    case 'certification': return <CertificationBlock section={section} onUpdate={onUpdate} />
    case 'skills':        return <SkillsBlock section={section} onUpdate={onUpdate} />
    case 'tools':         return <ToolsBlock section={section} onUpdate={onUpdate} />
    case 'languages':     return <LanguagesBlock section={section} onUpdate={onUpdate} />
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: errors for missing block components — that's expected, they come in Tasks 12–15.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/cv-builder/[id]/page.tsx src/app/dashboard/cv-builder/[id]/_components/cv-editor.tsx
git commit -m "feat(cv): add editor page and shell"
```

---

## Task 12: Block Wrapper + Section Rail

**Files:**
- Create: `src/app/dashboard/cv-builder/[id]/_components/cv-block.tsx`
- Create: `src/app/dashboard/cv-builder/[id]/_components/section-rail.tsx`

- [ ] **Step 1: Create the block wrapper**

The wrapper renders the block content and shows edit/hide/copy controls on hover. It also renders hidden blocks as ghost rows.

```tsx
// src/app/dashboard/cv-builder/[id]/_components/cv-block.tsx
'use client'

import { Eye, EyeOff, Copy } from 'lucide-react'
import type { CVSection } from '@/modules/cv/schema'

type Props = {
  section: CVSection
  onToggleVisibility: () => void
  onCopy: () => void
  children: React.ReactNode
}

export function CvBlock({ section, onToggleVisibility, onCopy, children }: Props) {
  if (!section.visible) {
    return (
      <div className="group flex items-center justify-between border-b border-border/30 px-6 py-2.5 opacity-40 last:border-b-0 print:hidden">
        <span className="text-xs italic text-muted-foreground capitalize">
          {section.type} — hidden
        </span>
        <button
          onClick={onToggleVisibility}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
        >
          <Eye className="size-3" />
          Show
        </button>
      </div>
    )
  }

  return (
    <div className="group relative border-b border-border/30 px-6 py-4 last:border-b-0 hover:bg-muted/20 print:hover:bg-transparent">
      {/* Controls */}
      <div className="absolute right-4 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 print:hidden">
        <button
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          title="Copy section"
        >
          <Copy className="size-3" />
        </button>
        <button
          onClick={onToggleVisibility}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          title="Hide section"
        >
          <EyeOff className="size-3" />
        </button>
      </div>

      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create the section rail**

```tsx
// src/app/dashboard/cv-builder/[id]/_components/section-rail.tsx
'use client'

import { Eye, EyeOff } from 'lucide-react'
import type { CVSection } from '@/modules/cv/schema'

const SECTION_LABELS: Record<CVSection['type'], string> = {
  header: 'Header',
  profile: 'Profile',
  competencies: 'Competencies',
  capabilities: 'Capabilities',
  experience: 'Experience',
  education: 'Education',
  certification: 'Certifications',
  skills: 'Skills',
  tools: 'Tools',
  languages: 'Languages',
}

type Props = {
  sections: CVSection[]
  onToggleVisibility: (id: string) => void
}

export function SectionRail({ sections, onToggleVisibility }: Props) {
  return (
    <div className="w-48 shrink-0 overflow-y-auto border-l border-border bg-muted/20 p-4 print:hidden">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Sections
      </p>
      <div className="flex flex-col gap-1">
        {sections.map(section => (
          <div
            key={section.id}
            className="group flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted"
          >
            <span className={section.visible ? 'text-foreground' : 'text-muted-foreground line-through'}>
              {SECTION_LABELS[section.type] ?? section.type}
            </span>
            <button
              onClick={() => onToggleVisibility(section.id)}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              title={section.visible ? 'Hide' : 'Show'}
            >
              {section.visible
                ? <EyeOff className="size-3 text-muted-foreground" />
                : <Eye className="size-3 text-muted-foreground" />
              }
            </button>
          </div>
        ))}
      </div>

      {/* ATS stub — Phase 2 */}
      <div className="mt-6 rounded-md border border-dashed border-border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">ATS Score</p>
        <div className="mb-2 h-1.5 w-full rounded-full bg-muted" />
        <button
          disabled
          className="w-full rounded px-2 py-1 text-xs text-muted-foreground opacity-50"
          title="Coming soon"
        >
          Run analysis →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: errors only for missing block files — expected.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/cv-builder/[id]/_components/cv-block.tsx src/app/dashboard/cv-builder/[id]/_components/section-rail.tsx
git commit -m "feat(cv): add block wrapper and section rail"
```

---

## Task 13: Header, Profile, Competencies, Capabilities Blocks

**Files:**
- Create: `src/app/dashboard/cv-builder/[id]/_components/blocks/header-block.tsx`
- Create: `src/app/dashboard/cv-builder/[id]/_components/blocks/profile-block.tsx`
- Create: `src/app/dashboard/cv-builder/[id]/_components/blocks/competencies-block.tsx`
- Create: `src/app/dashboard/cv-builder/[id]/_components/blocks/capabilities-block.tsx`

Each block has a view mode and an edit mode. Clicking "Edit" expands inline form fields.

- [ ] **Step 1: Create header-block.tsx**

```tsx
// src/app/dashboard/cv-builder/[id]/_components/blocks/header-block.tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { CVSection, HeaderData } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'header'; data: HeaderData }
  onUpdate: (section: CVSection) => void
}

export function HeaderBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data)

  function save() {
    onUpdate({ ...section, data: draft })
    setEditing(false)
  }

  function cancel() {
    setDraft(section.data)
    setEditing(false)
  }

  const { name, headline, subHeadline, contact } = section.data

  if (!editing) {
    return (
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{name}</h1>
            <p className="text-base text-muted-foreground">{headline}</p>
            {subHeadline && (
              <p className="text-sm font-medium text-muted-foreground">{subHeadline}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {[contact.email, contact.phone, contact.linkedin, contact.website]
                .filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="ml-4 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 print:hidden"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Headline</Label>
          <Input value={draft.headline} onChange={e => setDraft({ ...draft, headline: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sub-headline (optional)</Label>
          <Input value={draft.subHeadline ?? ''} onChange={e => setDraft({ ...draft, subHeadline: e.target.value || undefined })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input value={draft.contact.email ?? ''} onChange={e => setDraft({ ...draft, contact: { ...draft.contact, email: e.target.value } })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input value={draft.contact.phone ?? ''} onChange={e => setDraft({ ...draft, contact: { ...draft.contact, phone: e.target.value } })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">LinkedIn</Label>
          <Input value={draft.contact.linkedin ?? ''} onChange={e => setDraft({ ...draft, contact: { ...draft.contact, linkedin: e.target.value } })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Website</Label>
          <Input value={draft.contact.website ?? ''} onChange={e => setDraft({ ...draft, contact: { ...draft.contact, website: e.target.value } })} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save}><Check className="mr-1 size-3" />Save</Button>
        <Button size="sm" variant="ghost" onClick={cancel}><X className="mr-1 size-3" />Cancel</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create profile-block.tsx**

```tsx
// src/app/dashboard/cv-builder/[id]/_components/blocks/profile-block.tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { CVSection } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'profile' }
  onUpdate: (section: CVSection) => void
}

export function ProfileBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data.content)

  function save() {
    onUpdate({ ...section, data: { content: draft } })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">
          Professional Profile
        </h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 print:hidden"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={6}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">Markdown supported: **bold**, _italic_</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}><Check className="mr-1 size-3" />Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(section.data.content); setEditing(false) }}>
              <X className="mr-1 size-3" />Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <ReactMarkdown>{section.data.content}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create competencies-block.tsx**

```tsx
// src/app/dashboard/cv-builder/[id]/_components/blocks/competencies-block.tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CVSection } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'competencies' }
  onUpdate: (section: CVSection) => void
}

export function CompetenciesBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data.items)

  function save() {
    onUpdate({ ...section, data: { items: draft.filter(Boolean) } })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">Core Competencies</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 print:hidden">
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {draft.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input value={item} onChange={e => setDraft(draft.map((d, j) => j === i ? e.target.value : d))} className="text-sm" />
              <Button size="sm" variant="ghost" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setDraft([...draft, ''])}>
            <Plus className="mr-1 size-3" />Add
          </Button>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}><Check className="mr-1 size-3" />Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(section.data.items); setEditing(false) }}>
              <X className="mr-1 size-3" />Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-1">
          {section.data.items.map((item, i) => (
            <p key={i} className="text-sm text-muted-foreground">• {item}</p>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create capabilities-block.tsx**

Same pattern as competencies but with title "Capabilities":

```tsx
// src/app/dashboard/cv-builder/[id]/_components/blocks/capabilities-block.tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CVSection } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'capabilities' }
  onUpdate: (section: CVSection) => void
}

export function CapabilitiesBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data.items)

  function save() {
    onUpdate({ ...section, data: { items: draft.filter(Boolean) } })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">Capabilities</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 print:hidden">
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {draft.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input value={item} onChange={e => setDraft(draft.map((d, j) => j === i ? e.target.value : d))} className="text-sm" />
              <Button size="sm" variant="ghost" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setDraft([...draft, ''])}>
            <Plus className="mr-1 size-3" />Add
          </Button>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}><Check className="mr-1 size-3" />Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(section.data.items); setEditing(false) }}>
              <X className="mr-1 size-3" />Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-1">
          {section.data.items.map((item, i) => (
            <p key={i} className="text-sm text-muted-foreground">• {item}</p>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: errors only for remaining block files.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/cv-builder/[id]/_components/blocks/
git commit -m "feat(cv): add header, profile, competencies, capabilities blocks"
```

---

## Task 14: Experience, Education, Certification Blocks

**Files:**
- Create: `src/app/dashboard/cv-builder/[id]/_components/blocks/experience-block.tsx`
- Create: `src/app/dashboard/cv-builder/[id]/_components/blocks/education-block.tsx`
- Create: `src/app/dashboard/cv-builder/[id]/_components/blocks/certification-block.tsx`

- [ ] **Step 1: Create experience-block.tsx**

```tsx
// src/app/dashboard/cv-builder/[id]/_components/blocks/experience-block.tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { CVSection, ExperienceData } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'experience'; data: ExperienceData }
  onUpdate: (section: CVSection) => void
}

export function ExperienceBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data)
  const { company, titles, location, duration, description, outcomes } = section.data

  function save() {
    onUpdate({ ...section, data: { ...draft, outcomes: draft.outcomes.filter(Boolean), titles: draft.titles.filter(Boolean) } })
    setEditing(false)
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
          <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">
            Professional Experience
          </h2>
          <button onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 print:hidden">
            <Pencil className="size-3.5" />
          </button>
        </div>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-foreground">{company}</p>
          <p className="text-xs text-muted-foreground">{duration}</p>
        </div>
        <p className="text-xs italic text-muted-foreground">{titles.join(' → ')}</p>
        <p className="mb-2 text-xs text-muted-foreground">{location}</p>
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <ReactMarkdown>{description}</ReactMarkdown>
        </div>
        <ul className="mt-2 space-y-1">
          {outcomes.map((o, i) => (
            <li key={i} className="text-sm text-muted-foreground before:mr-2 before:content-['→']">
              <ReactMarkdown components={{ p: ({ children }) => <span>{children}</span> }}>{o}</ReactMarkdown>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="mb-2 border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">Professional Experience</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Company</Label>
          <Input value={draft.company} onChange={e => setDraft({ ...draft, company: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Duration</Label>
          <Input value={draft.duration} onChange={e => setDraft({ ...draft, duration: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Location</Label>
          <Input value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Titles (one per line — ordered most recent first)</Label>
        <Textarea
          value={draft.titles.join('\n')}
          onChange={e => setDraft({ ...draft, titles: e.target.value.split('\n') })}
          rows={2}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description (Markdown supported)</Label>
        <Textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={4} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Outcomes</Label>
        {draft.outcomes.map((o, i) => (
          <div key={i} className="flex gap-2">
            <Input value={o} onChange={e => setDraft({ ...draft, outcomes: draft.outcomes.map((x, j) => j === i ? e.target.value : x) })} className="text-sm" />
            <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, outcomes: draft.outcomes.filter((_, j) => j !== i) })}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, outcomes: [...draft.outcomes, ''] })}>
          <Plus className="mr-1 size-3" />Add outcome
        </Button>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save}><Check className="mr-1 size-3" />Save</Button>
        <Button size="sm" variant="ghost" onClick={() => { setDraft(section.data); setEditing(false) }}>
          <X className="mr-1 size-3" />Cancel
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create education-block.tsx**

```tsx
// src/app/dashboard/cv-builder/[id]/_components/blocks/education-block.tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CVSection, EducationData } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'education'; data: EducationData }
  onUpdate: (section: CVSection) => void
}

export function EducationBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data)
  const { institution, qualification, field, duration, grade } = section.data

  function save() {
    onUpdate({ ...section, data: draft })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">Education</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 print:hidden">
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {([
              ['Institution', 'institution'],
              ['Qualification', 'qualification'],
              ['Field (optional)', 'field'],
              ['Duration', 'duration'],
              ['Grade (optional)', 'grade'],
            ] as const).map(([label, key]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={(draft as Record<string, string | undefined>)[key] ?? ''} onChange={e => setDraft({ ...draft, [key]: e.target.value || undefined })} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}><Check className="mr-1 size-3" />Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(section.data); setEditing(false) }}>
              <X className="mr-1 size-3" />Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold text-foreground">{institution}</p>
          <p className="text-sm text-muted-foreground">{qualification}{field ? ` · ${field}` : ''}</p>
          <p className="text-xs text-muted-foreground">{duration}{grade ? ` · ${grade}` : ''}</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create certification-block.tsx**

```tsx
// src/app/dashboard/cv-builder/[id]/_components/blocks/certification-block.tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CVSection, CertificationData } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'certification'; data: CertificationData }
  onUpdate: (section: CVSection) => void
}

export function CertificationBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data)
  const { name, issuer, date, url } = section.data

  function save() {
    onUpdate({ ...section, data: draft })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">Certification</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 print:hidden">
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {([['Name', 'name'], ['Issuer (optional)', 'issuer'], ['Date (optional)', 'date'], ['URL (optional)', 'url']] as const).map(([label, key]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={(draft as Record<string, string | undefined>)[key] ?? ''} onChange={e => setDraft({ ...draft, [key]: e.target.value || undefined })} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}><Check className="mr-1 size-3" />Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(section.data); setEditing(false) }}>
              <X className="mr-1 size-3" />Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">
            {[issuer, date].filter(Boolean).join(' · ')}
          </p>
          {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{url}</a>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/cv-builder/[id]/_components/blocks/experience-block.tsx src/app/dashboard/cv-builder/[id]/_components/blocks/education-block.tsx src/app/dashboard/cv-builder/[id]/_components/blocks/certification-block.tsx
git commit -m "feat(cv): add experience, education, certification blocks"
```

---

## Task 15: Skills, Tools, Languages Blocks

**Files:**
- Create: `src/app/dashboard/cv-builder/[id]/_components/blocks/skills-block.tsx`
- Create: `src/app/dashboard/cv-builder/[id]/_components/blocks/tools-block.tsx`
- Create: `src/app/dashboard/cv-builder/[id]/_components/blocks/languages-block.tsx`

- [ ] **Step 1: Create skills-block.tsx**

```tsx
// src/app/dashboard/cv-builder/[id]/_components/blocks/skills-block.tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CVSection } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'skills' }
  onUpdate: (section: CVSection) => void
}

export function SkillsBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data.items)

  function save() {
    onUpdate({ ...section, data: { items: draft.filter(Boolean) } })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest">Skills</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 print:hidden">
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {draft.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input value={item} onChange={e => setDraft(draft.map((d, j) => j === i ? e.target.value : d))} className="text-sm" />
              <Button size="sm" variant="ghost" onClick={() => setDraft(draft.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setDraft([...draft, ''])}><Plus className="mr-1 size-3" />Add</Button>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}><Check className="mr-1 size-3" />Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(section.data.items); setEditing(false) }}><X className="mr-1 size-3" />Cancel</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{section.data.items.join(' · ')}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create tools-block.tsx**

```tsx
// src/app/dashboard/cv-builder/[id]/_components/blocks/tools-block.tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CVSection } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'tools' }
  onUpdate: (section: CVSection) => void
}

export function ToolsBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data.items)

  function save() {
    onUpdate({ ...section, data: { items: draft.filter(Boolean) } })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest">Tools</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 print:hidden">
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {draft.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input value={item} onChange={e => setDraft(draft.map((d, j) => j === i ? e.target.value : d))} className="text-sm" />
              <Button size="sm" variant="ghost" onClick={() => setDraft(draft.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setDraft([...draft, ''])}><Plus className="mr-1 size-3" />Add</Button>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}><Check className="mr-1 size-3" />Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(section.data.items); setEditing(false) }}><X className="mr-1 size-3" />Cancel</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{section.data.items.join(' · ')}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create languages-block.tsx**

```tsx
// src/app/dashboard/cv-builder/[id]/_components/blocks/languages-block.tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CVSection } from '@/modules/cv/schema'

type Props = {
  section: CVSection & { type: 'languages' }
  onUpdate: (section: CVSection) => void
}

export function LanguagesBlock({ section, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.data.items)

  function save() {
    onUpdate({ ...section, data: { items: draft.filter(i => i.name) } })
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
        <h2 className="text-xs font-bold uppercase tracking-widest">Languages</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 print:hidden">
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {draft.map((item, i) => (
            <div key={i} className="flex gap-2">
              <div className="flex flex-1 gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Language</Label>
                  <Input value={item.name} onChange={e => setDraft(draft.map((d, j) => j === i ? { ...d, name: e.target.value } : d))} />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Proficiency</Label>
                  <Input value={item.proficiency} onChange={e => setDraft(draft.map((d, j) => j === i ? { ...d, proficiency: e.target.value } : d))} />
                </div>
              </div>
              <Button size="sm" variant="ghost" className="self-end" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setDraft([...draft, { name: '', proficiency: '' }])}>
            <Plus className="mr-1 size-3" />Add
          </Button>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}><Check className="mr-1 size-3" />Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(section.data.items); setEditing(false) }}><X className="mr-1 size-3" />Cancel</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {section.data.items.map(l => `${l.name} (${l.proficiency})`).join(' · ')}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 5: Full test run**

```bash
npm test
```
Expected: all existing tests pass plus the new schema and export tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/cv-builder/[id]/_components/blocks/skills-block.tsx src/app/dashboard/cv-builder/[id]/_components/blocks/tools-block.tsx src/app/dashboard/cv-builder/[id]/_components/blocks/languages-block.tsx
git commit -m "feat(cv): add skills, tools, languages blocks"
```

---

## Task 16: Print CSS + End-to-End Smoke Test

**Files:**
- Create: `src/app/dashboard/cv-builder/[id]/print.css` (or add to global)

- [ ] **Step 1: Add print styles**

In `src/app/dashboard/cv-builder/[id]/page.tsx`, import a print stylesheet. Create the file:

```css
/* src/app/dashboard/cv-builder/[id]/print.css */
@media print {
  body * {
    visibility: hidden;
  }
  .cv-print-area,
  .cv-print-area * {
    visibility: visible;
  }
  .cv-print-area {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
  }
}
```

In `cv-editor.tsx`, add `cv-print-area` to the document container div:

```tsx
<div className="mx-auto max-w-2xl rounded-lg bg-background shadow-sm cv-print-area print:max-w-none print:shadow-none">
```

- [ ] **Step 2: End-to-end smoke test**

```bash
npm run dev
```

Run through this flow:

1. Sign in as `test@example.com` / `password`
2. Go to Job Applications — verify a CV icon is visible if a CV exists, "Generate CV" is in the `⋯` menu
3. Click "Generate CV" on a job that has a job description — verify the spinner appears and then redirects to the editor
4. In the editor: click a block's edit button, make a change, save — verify the change persists on page refresh
5. Click "⊘ Hide" on a section — verify it becomes a ghost row and disappears from the section rail
6. Click "⎘ Copy" on a section — verify the clipboard gets plain text
7. Click "Download Markdown" — verify a `.md` file downloads with the CV content
8. Verify the job row now shows the CV icon next to the job title

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/cv-builder/[id]/print.css
git commit -m "feat(cv): add print styles and complete CV builder feature"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Typed sections array (Approach B) — schema.ts
- ✅ Master + job-specific CVs — `jobApplicationId` nullable in createAndGenerateCV
- ✅ One-shot LLM generation — generateCVContent single completeStructured call
- ✅ Inline block editor — cv-editor.tsx + block components
- ✅ Edit/hide/copy per block — cv-block.tsx + block components
- ✅ Section rail — section-rail.tsx
- ✅ Generate CV entry from job list — AppControls + job-row
- ✅ CV icon in job row title — job-row.tsx
- ✅ Export: PDF, Markdown, text — cv-editor.tsx toolbar
- ✅ Per-section copy — cv-block.tsx copy button
- ✅ ATS stub — section-rail.tsx stub panel
- ✅ Discuss stub — toolbar button (disabled)
- ✅ Transferable skills in prompt — cv-generate.md
- ✅ Prompt files editable without touching TS — src/lib/prompts/cv-generate.md
- ✅ Feature label in usage log — usage-log.tsx
- ✅ cv-generate.md auto-bundled — next.config.ts already includes src/lib/prompts/*.md for /dashboard/**

**Type consistency:**
- `CVSection` discriminated union used consistently across schema.ts, export.ts, block components
- `onUpdate: (section: CVSection) => void` signature is the same in cv-editor.tsx and all blocks
- `parseCVContent` used in both queries.ts and actions.ts
- `sectionToPlainText` exported from export.ts and imported in cv-editor.tsx
