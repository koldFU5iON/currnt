# PDF CV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user upload a CV/resume PDF, extract it into the structured profile model via the LLM, review/deselect entries, and commit them to their profile.

**Architecture:** New `src/modules/profile-import/` module with thin, focused files. Pure logic (date parsing, the commit plan) is isolated from the two server actions (`extract`, `commit`) and the PDF/LLM I/O so it can be unit-tested without a DB or network. Mirrors the codebase's existing three-beat for experience notes: extract (no writes) → review in client state → commit transactionally.

**Tech Stack:** Next.js 16 App Router (Server Actions), Prisma 7 + Postgres, `unpdf` (PDF text), the existing BYO-key LLM façade (`completeStructured`), Zod 4, Vitest (new — no test runner exists yet), shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-05-30-pdf-cv-import-design.md`
**Benchmark PDF (local, gitignored):** `docs/samples/devon-stanton_linkedin-profile.pdf`

---

## File Structure

```
src/modules/profile-import/
  pdf.ts          extractPdfText(bytes): unpdf wrapper. Pure I/O seam.
  date-parse.ts   parseMonthYear / parseYear: CV date strings → Date | null
  schema.ts       Zod ExtractedProfile + types + emptyExtractedProfile
  plan.ts         buildCommitPlan(extracted, existing): pure dedup + empty-fill + skip rules
  extract.ts      'use server' extractProfileFromPdf(formData)
  commit.ts       'use server' commitImportedProfile(payload)

src/app/dashboard/profile/
  page.tsx                                 (modify: render import button)
  _components/ImportProfileDialog.tsx      (create: upload → review → commit UI)

prisma/schema/profile.prisma               (modify: Certification.issuer/issueDate nullable)
src/modules/profile/duplicate-detect.ts    (modify: export `normalize`)

vitest.config.ts                           (create)
package.json                               (modify: deps + test scripts)
```

Test files live next to their source as `*.test.ts`.

---

## Task 1: Add dependencies and Vitest

**Files:**
- Modify: `package.json` (scripts)
- Create: `vitest.config.ts`
- Create: `src/modules/profile-import/smoke.test.ts` (temporary, deleted in Step 5)

- [ ] **Step 1: Install dependencies**

```bash
npm install unpdf
npm install -D vitest
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts` (manual `@/` alias avoids an extra dependency):

```ts
import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
})
```

- [ ] **Step 3: Add test scripts**

In `package.json`, add to `"scripts"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 4: Verify the runner works**

Create `src/modules/profile-import/smoke.test.ts`:

```ts
import { expect, test } from "vitest"

test("vitest runs", () => {
  expect(1 + 1).toBe(2)
})
```

Run: `npx vitest run src/modules/profile-import/smoke.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Delete the smoke test and commit**

```bash
rm src/modules/profile-import/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest and unpdf for PDF CV import"
```

---

## Task 2: Date parsing (`date-parse.ts`)

CV dates come as `"July 2024"`, `"(1997 - 2001)"` year-only, and `"Present"`. The LLM emits normalized strings (`"YYYY-MM"` for experience, `"YYYY"` for education, `null` for Present/absent); this module turns those into `Date | null`. Day is always the 1st; we use UTC to avoid timezone drift.

**Files:**
- Create: `src/modules/profile-import/date-parse.ts`
- Test: `src/modules/profile-import/date-parse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest"
import { parseMonthYear, parseYear } from "./date-parse"

test("parseMonthYear parses YYYY-MM to first of month UTC", () => {
  const d = parseMonthYear("2024-07")
  expect(d?.toISOString()).toBe("2024-07-01T00:00:00.000Z")
})

test("parseMonthYear returns null for null, empty, and garbage", () => {
  expect(parseMonthYear(null)).toBeNull()
  expect(parseMonthYear("")).toBeNull()
  expect(parseMonthYear("Present")).toBeNull()
  expect(parseMonthYear("not-a-date")).toBeNull()
})

test("parseMonthYear rejects an out-of-range month", () => {
  expect(parseMonthYear("2024-13")).toBeNull()
})

test("parseYear parses YYYY to Jan 1 UTC", () => {
  expect(parseYear("1997")?.toISOString()).toBe("1997-01-01T00:00:00.000Z")
})

test("parseYear returns null for null and garbage", () => {
  expect(parseYear(null)).toBeNull()
  expect(parseYear("nope")).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/profile-import/date-parse.test.ts`
Expected: FAIL — cannot find module `./date-parse`.

- [ ] **Step 3: Write the implementation**

Create `src/modules/profile-import/date-parse.ts`:

```ts
// CV date strings → Date | null. The LLM normalizes raw PDF dates ("July 2024",
// "(1997 - 2001)", "Present") into "YYYY-MM" / "YYYY" / null before they reach
// here; this is the single place those strings become Dates. Day is always the
// 1st, in UTC, so a stored date never shifts across timezones.

export function parseMonthYear(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return new Date(Date.UTC(year, month - 1, 1))
}

export function parseYear(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})$/.exec(value.trim())
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), 0, 1))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/profile-import/date-parse.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/profile-import/date-parse.ts src/modules/profile-import/date-parse.test.ts
git commit -m "feat: add CV date string parsing for profile import"
```

---

## Task 3: Extraction schema (`schema.ts`)

The Zod schema the LLM fills. Plain module (no `'use server'`) so it's importable from both the server action and tests. Field `.describe()` text doubles as model instructions (same convention as `profile/extract-schema.ts`).

**Files:**
- Create: `src/modules/profile-import/schema.ts`
- Test: `src/modules/profile-import/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest"
import { ExtractedProfileSchema, emptyExtractedProfile } from "./schema"

test("schema parses a representative extracted profile", () => {
  const input = {
    contact: {
      name: "Devon Stanton",
      headline: "Senior Program Manager",
      location: "Le Chesnay, Île-de-France, France",
      email: "devon.stanton@gmail.com",
      phone: "+330610036295",
      linkedIn: "www.linkedin.com/in/devonstanton",
      website: null,
      github: null,
    },
    summary: "Some people tell the story. Some people build the stage.",
    experiences: [
      {
        company: "Unity",
        role: "Snr Program Manager",
        startDate: "2024-07",
        endDate: null,
        location: "France",
        remote: false,
        summary: "Promoted into global program ownership role.",
        activities: [
          { kind: "responsibility", description: "Lead global delivery of partner-facing initiatives", impact: null },
          { kind: "achievement", description: "Scaled campaign visibility infrastructure", impact: "40 → 5,000+ tracked projects" },
        ],
      },
    ],
    education: [
      { institution: "Vega", qualification: "Business Communications", field: "Branding", startDate: "2008", endDate: "2011" },
    ],
    certifications: [
      { name: "Learn SQL Course", issuer: null, issueDate: null },
    ],
    skills: [
      { name: "AI Fluency", category: null },
    ],
  }
  const parsed = ExtractedProfileSchema.parse(input)
  expect(parsed.experiences[0].activities[1].kind).toBe("achievement")
  expect(parsed.certifications[0].issuer).toBeNull()
})

test("emptyExtractedProfile is a valid parse", () => {
  expect(() => ExtractedProfileSchema.parse(emptyExtractedProfile)).not.toThrow()
})

test("schema rejects an invalid activity kind", () => {
  const bad = { ...emptyExtractedProfile, experiences: [{
    company: "X", role: "Y", startDate: "2020-01", endDate: null, location: null, remote: false, summary: null,
    activities: [{ kind: "duty", description: "z", impact: null }],
  }] }
  expect(() => ExtractedProfileSchema.parse(bad)).toThrow()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/profile-import/schema.test.ts`
Expected: FAIL — cannot find module `./schema`.

- [ ] **Step 3: Write the implementation**

Create `src/modules/profile-import/schema.ts`:

```ts
import * as z from "zod"

// The shape the LLM fills from raw CV text. Plain module (no 'use server') so
// both extract.ts and tests can import it. Constraints are intentionally loose
// (no array min/max): a slightly-off count must not cost a paid retry. Dates are
// strings here and become Dates later in date-parse.ts.

const ActivitySchema = z.object({
  kind: z.enum(["responsibility", "achievement"])
    .describe('"responsibility" = an ongoing duty or scope of work. "achievement" = a specific outcome or measurable result. When ambiguous, prefer responsibility.'),
  description: z.string().min(1)
    .describe("A single bullet describing the activity. Stands alone — no leading conjunctions or pronouns referring to other bullets."),
  impact: z.string().nullable()
    .describe("Optional measurable outcome or numeric result lifted from the bullet (e.g. '40 → 5,000+ tracked projects'). Null when none — never fabricate."),
})

const ExperienceSchema = z.object({
  company: z.string().min(1).describe("Employer name."),
  role: z.string().min(1).describe("Job title for this specific position."),
  startDate: z.string().nullable()
    .describe('Start month as "YYYY-MM". Null only if truly absent. NEVER use the company-level tenure total (e.g. "5 years 3 months") as a date.'),
  endDate: z.string().nullable()
    .describe('End month as "YYYY-MM". Null means the role is current ("Present").'),
  location: z.string().nullable().describe("City/region for the role, if shown."),
  remote: z.boolean().describe("True only if the role is explicitly remote."),
  summary: z.string().nullable().describe("The role's intro paragraph (prose above the bullets), if any."),
  activities: z.array(ActivitySchema),
})

const EducationSchema = z.object({
  institution: z.string().min(1),
  qualification: z.string().min(1).describe("Degree or programme name (e.g. 'Business Communications', 'Matriculated')."),
  field: z.string().nullable().describe("Field of study, if distinct from the qualification."),
  startDate: z.string().nullable().describe('Start year as "YYYY".'),
  endDate: z.string().nullable().describe('End year as "YYYY".'),
})

const CertificationSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().nullable().describe("Issuing organisation. Null when the CV does not name one."),
  issueDate: z.string().nullable().describe('Issue month as "YYYY-MM". Null when no date is shown.'),
})

const SkillSchema = z.object({
  name: z.string().min(1),
  category: z.string().nullable().describe('Grouping label (e.g. "Marketing", "Engineering"). Null when unclear.'),
})

const ContactSchema = z.object({
  name: z.string().nullable(),
  headline: z.string().nullable().describe("The tagline under the name (e.g. 'Senior Program Manager | ...')."),
  location: z.string().nullable().describe("City/region line — NOT the street address."),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedIn: z.string().nullable(),
  website: z.string().nullable(),
  github: z.string().nullable(),
})

export const ExtractedProfileSchema = z.object({
  contact: ContactSchema,
  summary: z.string().nullable().describe("The free-text professional summary / about section."),
  experiences: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  certifications: z.array(CertificationSchema),
  skills: z.array(SkillSchema).describe('Includes any "Top Skills" section; ordering is not preserved.'),
})

export type ExtractedProfile = z.infer<typeof ExtractedProfileSchema>
export type ExtractedExperience = z.infer<typeof ExperienceSchema>
export type ExtractedActivity = z.infer<typeof ActivitySchema>

export const emptyExtractedProfile: ExtractedProfile = {
  contact: { name: null, headline: null, location: null, email: null, phone: null, linkedIn: null, website: null, github: null },
  summary: null,
  experiences: [],
  education: [],
  certifications: [],
  skills: [],
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/profile-import/schema.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/profile-import/schema.ts src/modules/profile-import/schema.test.ts
git commit -m "feat: add extracted-profile schema for PDF import"
```

---

## Task 4: Export `normalize` from duplicate-detect

`buildCommitPlan` (next task) needs the same normalization the codebase already uses for near-match detection. Export it instead of duplicating.

**Files:**
- Modify: `src/modules/profile/duplicate-detect.ts:8`

- [ ] **Step 1: Make `normalize` exported**

In `src/modules/profile/duplicate-detect.ts`, change the function declaration on line 8 from:

```ts
function normalize(s: string): string {
```

to:

```ts
export function normalize(s: string): string {
```

- [ ] **Step 2: Verify nothing broke**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/profile/duplicate-detect.ts
git commit -m "refactor: export normalize() for reuse in profile import"
```

---

## Task 5: Commit plan (`plan.ts`)

Pure function that turns an `ExtractedProfile` (already filtered/edited by the user) plus the profile's current state into an exact write plan: which contact fields to fill (only empty ones — never clobber), which entities to create, and which to skip (duplicates, or entries with no parseable required date). All DB-free, so it's fully unit-tested.

Note on contact fields: the 8 `contact.*` columns map 1:1 to `Profile` columns, but `summary` lives at the top level of `ExtractedProfile`, so it is handled separately from the `CONTACT_FIELDS` loop.

**Files:**
- Create: `src/modules/profile-import/plan.ts`
- Test: `src/modules/profile-import/plan.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest"
import { buildCommitPlan, type ExistingProfileState } from "./plan"
import { emptyExtractedProfile, type ExtractedProfile } from "./schema"

const emptyExisting: ExistingProfileState = {
  contact: { name: "", email: "", phone: "", location: "", website: "", linkedIn: "", github: "", headline: "" },
  summary: "",
  experienceKeys: new Set(),
  skillKeys: new Set(),
}

function withExperience(over: Partial<ExtractedProfile["experiences"][number]> = {}): ExtractedProfile {
  return {
    ...emptyExtractedProfile,
    experiences: [{
      company: "Unity", role: "Snr Program Manager", startDate: "2024-07", endDate: null,
      location: "France", remote: false, summary: "intro",
      activities: [{ kind: "responsibility", description: "Lead delivery", impact: null }],
      ...over,
    }],
  }
}

test("fills only empty contact fields, never clobbers", () => {
  const extracted: ExtractedProfile = {
    ...emptyExtractedProfile,
    contact: { ...emptyExtractedProfile.contact, name: "Devon", email: "new@x.com", location: "Paris" },
  }
  const existing: ExistingProfileState = {
    ...emptyExisting,
    contact: { ...emptyExisting.contact, name: "Devon Stanton", email: "" },
  }
  const plan = buildCommitPlan(extracted, existing)
  expect(plan.contactUpdate.email).toBe("new@x.com")
  expect(plan.contactUpdate.location).toBe("Paris")
  expect(plan.contactUpdate.name).toBeUndefined() // already set — not overwritten
})

test("fills summary only when existing summary is empty", () => {
  const extracted: ExtractedProfile = { ...emptyExtractedProfile, summary: "New summary" }
  expect(buildCommitPlan(extracted, emptyExisting).contactUpdate.summary).toBe("New summary")
  const existing: ExistingProfileState = { ...emptyExisting, summary: "Existing" }
  expect(buildCommitPlan(extracted, existing).contactUpdate.summary).toBeUndefined()
})

test("converts experience dates and includes a valid experience", () => {
  const plan = buildCommitPlan(withExperience(), emptyExisting)
  expect(plan.experiences).toHaveLength(1)
  expect(plan.experiences[0].startDate.toISOString()).toBe("2024-07-01T00:00:00.000Z")
  expect(plan.experiences[0].endDate).toBeNull()
})

test("skips an experience that duplicates an existing company+role", () => {
  const existing: ExistingProfileState = { ...emptyExisting, experienceKeys: new Set(["unity|snr program manager"]) }
  const plan = buildCommitPlan(withExperience(), existing)
  expect(plan.experiences).toHaveLength(0)
  expect(plan.skipped).toContainEqual({ type: "experience", label: "Snr Program Manager — Unity", reason: "duplicate" })
})

test("skips an experience with no parseable start date", () => {
  const plan = buildCommitPlan(withExperience({ startDate: null }), emptyExisting)
  expect(plan.experiences).toHaveLength(0)
  expect(plan.skipped[0].reason).toBe("missing start date")
})

test("certifications keep nullable issuer/date; skills get defaults", () => {
  const extracted: ExtractedProfile = {
    ...emptyExtractedProfile,
    certifications: [{ name: "Learn SQL Course", issuer: null, issueDate: null }],
    skills: [{ name: "AI Fluency", category: null }],
  }
  const plan = buildCommitPlan(extracted, emptyExisting)
  expect(plan.certifications[0]).toEqual({ name: "Learn SQL Course", issuer: null, issueDate: null })
  expect(plan.skills[0]).toEqual({ name: "AI Fluency", category: "General", level: "Intermediate" })
})

test("dedups skills against existing by normalized name", () => {
  const extracted: ExtractedProfile = { ...emptyExtractedProfile, skills: [{ name: "AI Fluency", category: null }] }
  const existing: ExistingProfileState = { ...emptyExisting, skillKeys: new Set(["ai fluency"]) }
  const plan = buildCommitPlan(extracted, existing)
  expect(plan.skills).toHaveLength(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/profile-import/plan.test.ts`
Expected: FAIL — cannot find module `./plan`.

- [ ] **Step 3: Write the implementation**

Create `src/modules/profile-import/plan.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/profile-import/plan.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/profile-import/plan.ts src/modules/profile-import/plan.test.ts
git commit -m "feat: add pure commit-plan builder for profile import"
```

---

## Task 6: Certification schema migration

Make `Certification.issuer` and `issueDate` nullable so LinkedIn certs (which carry neither) can import.

**Files:**
- Modify: `prisma/schema/profile.prisma` (model `Certification`, lines 143-144)

- [ ] **Step 1: Edit the schema**

In `prisma/schema/profile.prisma`, in `model Certification`, change:

```prisma
  issuer        String
  issueDate     DateTime
```

to:

```prisma
  issuer        String?
  issueDate     DateTime?
```

- [ ] **Step 2: Ensure Postgres is running**

Run: `docker compose up -d`
Expected: the Postgres container is up (port 5435).

- [ ] **Step 3: Create and apply the migration**

Run: `npm run db:migrate -- --name make_certification_issuer_date_optional`
Expected: a new migration under `prisma/migrations/`, applied cleanly, client regenerated.

- [ ] **Step 4: Verify types regenerated**

Run: `npm run typecheck`
Expected: no errors (existing cert create calls still compile — they pass both fields).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema/profile.prisma prisma/migrations
git commit -m "feat: make certification issuer and issueDate optional"
```

---

## Task 7: PDF text extraction (`pdf.ts`)

Thin `unpdf` wrapper — the single swappable seam for PDF parsing.

**Files:**
- Create: `src/modules/profile-import/pdf.ts`

- [ ] **Step 1: Write the implementation**

Create `src/modules/profile-import/pdf.ts`:

```ts
import { extractText, getDocumentProxy } from "unpdf"

// The one place we touch a PDF parser. Returns merged plain text across all
// pages; an image-only/scanned PDF yields little-to-no text, which the caller
// treats as the `no_text` case (no OCR in v1).
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes)
  const { text } = await extractText(pdf, { mergePages: true })
  return text.trim()
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors (confirms the `unpdf` import resolves).

- [ ] **Step 3: Commit**

```bash
git add src/modules/profile-import/pdf.ts
git commit -m "feat: add unpdf text extraction wrapper"
```

> Note: `pdf.ts` is verified end-to-end in Task 11 against the real sample PDF; it has no unit test because mocking `unpdf` would only test the mock.

---

## Task 8: Extraction server action (`extract.ts`)

Validates the upload, guards on the LLM key, parses the PDF, runs structured extraction. No DB writes. Returns a discriminated union matching the codebase convention. `LLMError.kind` (type `LLMErrorKind`) is confirmed present in `src/modules/llm/errors.ts`.

**Files:**
- Create: `src/modules/profile-import/extract.ts`

- [ ] **Step 1: Write the implementation**

Create `src/modules/profile-import/extract.ts`:

```ts
"use server"

import { requireProfile } from "@/lib/session"
import { completeStructured, getLLMConfigStatus } from "@/modules/llm/client"
import { LLMError, type LLMErrorKind } from "@/modules/llm/errors"
import { extractPdfText } from "./pdf"
import { ExtractedProfileSchema, type ExtractedProfile } from "./schema"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export type ExtractResult =
  | { ok: true; data: ExtractedProfile }
  | { ok: false; error: "no_file" | "not_pdf" | "too_large" | "no_text" | LLMErrorKind; message: string }

const SYSTEM = `You extract a structured career profile from the raw text of a CV/resume PDF.

Rules:
- Extract only what is present. Never invent employers, dates, metrics, or skills.
- LinkedIn-exported CVs group several roles under one company with a tenure total like "5 years 3 months". Emit ONE experience per role, repeat the company on each, and NEVER use that company-level total as a role's dates.
- Dates: experiences use "YYYY-MM"; education uses "YYYY". A current role's endDate is null ("Present").
- For each role, put the intro paragraph in "summary" and the bullet points in "activities" (responsibility vs achievement; pull any number/outcome into "impact").
- Use the city/region line for location, never the street address.
- Output only the JSON schema — no prose.`

export async function extractProfileFromPdf(formData: FormData): Promise<ExtractResult> {
  const { profile } = await requireProfile()

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { ok: false, error: "no_file", message: "Choose a PDF file to import." }
  }
  if (file.type !== "application/pdf") {
    return { ok: false, error: "not_pdf", message: "That file isn't a PDF. Export your CV as a PDF and try again." }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "too_large", message: "That PDF is over 10 MB. Try a smaller export." }
  }

  const status = await getLLMConfigStatus(profile.id)
  if (!status.configured) {
    return { ok: false, error: "not_configured", message: "Add an LLM API key at /dashboard/settings/llm to import a CV." }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const text = await extractPdfText(bytes)
  if (text.length < 50) {
    return {
      ok: false,
      error: "no_text",
      message: "Couldn't read any text from that PDF — it may be a scanned image. Try a text-based PDF or add your details manually.",
    }
  }

  try {
    const result = await completeStructured(
      profile.id,
      `# CV text\n\n${text}\n\nExtract the structured profile as JSON matching the schema.`,
      ExtractedProfileSchema,
      { system: SYSTEM, temperature: 0.1, maxOutputTokens: 6000 },
    )
    return { ok: true, data: result.object }
  } catch (err) {
    if (err instanceof LLMError) {
      return { ok: false, error: err.kind, message: err.message }
    }
    throw err
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/profile-import/extract.ts
git commit -m "feat: add PDF profile extraction server action"
```

---

## Task 9: Commit server action (`commit.ts`)

Loads current profile state, builds the plan (Task 5), and executes it in one transaction. Nested activity creates ride along with each experience. Returns created counts and the skipped list for the UI.

**Files:**
- Create: `src/modules/profile-import/commit.ts`

- [ ] **Step 1: Write the implementation**

Create `src/modules/profile-import/commit.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (Confirms the nullable cert fields from Task 6 accept `undefined`.)

- [ ] **Step 3: Commit**

```bash
git add src/modules/profile-import/commit.ts
git commit -m "feat: add transactional profile-import commit action"
```

---

## Task 10: Import dialog UI + profile page button

Client component: pick a PDF → extract → review (deselect entries, edit experience/education dates) → import. Full per-field editing is out of scope; everything stays editable on the profile page after import.

The profile page (`src/app/dashboard/profile/page.tsx`) is a Server Component that renders inside `<ContentContainer title="Profile Page" fullWidth>`. We add the dialog as the first child of that container, right-aligned.

**Files:**
- Create: `src/app/dashboard/profile/_components/ImportProfileDialog.tsx`
- Modify: `src/app/dashboard/profile/page.tsx`

- [ ] **Step 1: Confirm shadcn components exist**

Run: `ls src/components/ui`
Expected: includes `dialog.tsx`, `button.tsx`, `input.tsx`, `checkbox.tsx`, `label.tsx`. (Verified present at planning time.)

- [ ] **Step 2: Create the dialog component**

Create `src/app/dashboard/profile/_components/ImportProfileDialog.tsx`:

```tsx
"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { extractProfileFromPdf, type ExtractResult } from "@/modules/profile-import/extract"
import { commitImportedProfile, type CommitResult } from "@/modules/profile-import/commit"
import type { ExtractedProfile } from "@/modules/profile-import/schema"

type Stage =
  | { name: "idle" }
  | { name: "extracting" }
  | { name: "error"; message: string }
  | { name: "review"; data: ExtractedProfile; excluded: Set<string> }
  | { name: "committing"; data: ExtractedProfile; excluded: Set<string> }
  | { name: "done"; result: CommitResult }

export function ImportProfileDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>({ name: "idle" })
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStage({ name: "idle" })
    if (fileRef.current) fileRef.current.value = ""
  }

  async function onExtract() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setStage({ name: "error", message: "Choose a PDF file first." })
      return
    }
    setStage({ name: "extracting" })
    const fd = new FormData()
    fd.set("file", file)
    const result: ExtractResult = await extractProfileFromPdf(fd)
    if (!result.ok) {
      setStage({ name: "error", message: result.message })
      return
    }
    setStage({ name: "review", data: result.data, excluded: new Set() })
  }

  function toggle(key: string) {
    setStage((s) => {
      if (s.name !== "review") return s
      const excluded = new Set(s.excluded)
      if (excluded.has(key)) excluded.delete(key)
      else excluded.add(key)
      return { ...s, excluded }
    })
  }

  function editExpDate(idx: number, field: "startDate" | "endDate", value: string) {
    setStage((s) => {
      if (s.name !== "review") return s
      const data = structuredClone(s.data)
      data.experiences[idx][field] = value || null
      return { ...s, data }
    })
  }

  async function onCommit() {
    if (stage.name !== "review") return
    const { data, excluded } = stage
    const payload: ExtractedProfile = {
      ...data,
      experiences: data.experiences.filter((_, i) => !excluded.has(`exp-${i}`)),
      education: data.education.filter((_, i) => !excluded.has(`edu-${i}`)),
      certifications: data.certifications.filter((_, i) => !excluded.has(`cert-${i}`)),
      skills: data.skills.filter((_, i) => !excluded.has(`skill-${i}`)),
    }
    setStage({ name: "committing", data, excluded })
    const result = await commitImportedProfile(payload)
    setStage({ name: "done", result })
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline">Import from PDF</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import profile from PDF</DialogTitle>
          <DialogDescription>
            Upload a CV/resume PDF. Exporting from LinkedIn? Open your profile → <b>More</b> → <b>Save to PDF</b>.
            Importing only fills empty fields — it never overwrites what you&apos;ve already written.
          </DialogDescription>
        </DialogHeader>

        {(stage.name === "idle" || stage.name === "error" || stage.name === "extracting") && (
          <div className="space-y-3">
            <Input ref={fileRef} type="file" accept="application/pdf" />
            {stage.name === "error" && <p className="text-sm text-destructive">{stage.message}</p>}
            <Button onClick={onExtract} disabled={stage.name === "extracting"}>
              {stage.name === "extracting" ? "Reading…" : "Extract"}
            </Button>
          </div>
        )}

        {stage.name === "review" && (
          <div className="space-y-5">
            <div>
              <h3 className="mb-1 text-sm font-semibold">Experience ({stage.data.experiences.length})</h3>
              {stage.data.experiences.map((e, i) => {
                const key = `exp-${i}`
                return (
                  <div key={key} className="flex items-start gap-2 border-b py-2">
                    <Checkbox checked={!stage.excluded.has(key)} onCheckedChange={() => toggle(key)} className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{e.role} — {e.company}</p>
                      <div className="flex items-center gap-2">
                        <Label className="w-16 text-xs">Start</Label>
                        <Input value={e.startDate ?? ""} placeholder="YYYY-MM" onChange={(ev) => editExpDate(i, "startDate", ev.target.value)} className="h-7 w-28 text-xs" />
                        <Label className="w-10 text-xs">End</Label>
                        <Input value={e.endDate ?? ""} placeholder="Present" onChange={(ev) => editExpDate(i, "endDate", ev.target.value)} className="h-7 w-28 text-xs" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <SimpleList title="Education" items={stage.data.education.map((e) => `${e.qualification} — ${e.institution}`)} prefix="edu" excluded={stage.excluded} onToggle={toggle} />
            <SimpleList title="Certifications" items={stage.data.certifications.map((c) => c.name)} prefix="cert" excluded={stage.excluded} onToggle={toggle} />
            <SimpleList title="Skills" items={stage.data.skills.map((s) => s.name)} prefix="skill" excluded={stage.excluded} onToggle={toggle} />

            <DialogFooter>
              <Button onClick={onCommit}>Import selected</Button>
            </DialogFooter>
          </div>
        )}

        {stage.name === "committing" && <p className="text-sm">Saving…</p>}

        {stage.name === "done" && (
          <div className="space-y-3">
            <p className="text-sm">
              Imported {stage.result.created.experiences} experiences, {stage.result.created.education} education,
              {" "}{stage.result.created.certifications} certifications, {stage.result.created.skills} skills,
              and filled {stage.result.created.contactFields} contact fields.
            </p>
            {stage.result.skipped.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Skipped:</p>
                <ul className="list-disc pl-5">
                  {stage.result.skipped.map((s, i) => <li key={i}>{s.label} — {s.reason}</li>)}
                </ul>
              </div>
            )}
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SimpleList({ title, items, prefix, excluded, onToggle }: {
  title: string; items: string[]; prefix: string; excluded: Set<string>; onToggle: (key: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{title} ({items.length})</h3>
      {items.map((label, i) => {
        const key = `${prefix}-${i}`
        return (
          <label key={key} className="flex items-center gap-2 border-b py-1.5 text-sm">
            <Checkbox checked={!excluded.has(key)} onCheckedChange={() => onToggle(key)} />
            <span>{label}</span>
          </label>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Add the button to the profile page**

In `src/app/dashboard/profile/page.tsx`:

(a) Add the import near the other `_components` imports:

```tsx
import { ImportProfileDialog } from "./_components/ImportProfileDialog"
```

(b) Inside the `return (`, immediately after `<ContentContainer title="Profile Page" fullWidth>`, add a right-aligned action row as the first child:

```tsx
      <div className="mb-4 flex justify-end">
        <ImportProfileDialog />
      </div>
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/profile/_components/ImportProfileDialog.tsx src/app/dashboard/profile/page.tsx
git commit -m "feat: add import-from-PDF dialog to profile page"
```

---

## Task 11: End-to-end verification with the sample PDF

Manual verification against the real benchmark — the only way to validate PDF parsing + the extraction prompt together.

**Files:** none (verification only)

- [ ] **Step 1: Ensure DB is up and an LLM key is configured**

Run: `docker compose up -d`
Then: `npm run dev`. Sign in as `test@example.com` / `password`. Confirm an LLM key is saved at `/dashboard/settings/llm` (add one if not).

- [ ] **Step 2: Import the sample**

`/dashboard/profile` → **Import from PDF** → choose `docs/samples/devon-stanton_linkedin-profile.pdf` → **Extract**.

Expected review screen:
- **11 experiences** across 6 companies (Unity ×4, Blizzard ×1, 2K ×1, Megarom ×3, The Digital War Room ×1, Gamerlobby ×1), each with a `YYYY-MM` start date; the current Unity role's End is blank.
- **3 education** entries (On Cue Communications, Vega, St Stithians College).
- **5 certifications** (Custom Reporting, Create a Front-End App with React Skill Path, Learn SQL Course, Revenue Operations, Certificate of completion: Claude code 101).
- **Skills** including AI Fluency, Marketing Operations, Online Branding.
- No "5 years 3 months" / "7 years 7 months" tenure totals appearing as a role.

- [ ] **Step 3: Commit the import and verify writes**

Click **Import selected**. Expect the success summary. The profile page should now show the experiences, education, certifications, and skills, with the contact block filled (headline, location, email, phone, linkedIn) and the summary populated.

- [ ] **Step 4: Verify the no-overwrite + dedup guarantees**

Re-run the import with the same PDF. Expect every experience and skill reported under **Skipped → duplicate**, and existing contact fields unchanged.

- [ ] **Step 5: Verify the no-key and bad-file paths**

Temporarily remove the LLM key → import → expect the "Add an LLM API key" message. Try a non-PDF file → expect the "isn't a PDF" message.

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npm run test && npm run typecheck`
Expected: all unit tests pass; no type errors.

- [ ] **Step 7: Note any prompt corrections**

If extraction mis-nested roles or mangled a date, adjust the `SYSTEM` prompt / `.describe()` text in `extract.ts` / `schema.ts`, re-run Step 2, and commit:

```bash
git commit -am "fix: tune CV extraction prompt against sample profile"
```

---

## Task 12: Close out the issues

**Files:** none (GitHub housekeeping)

- [ ] **Step 1: Comment on #4 and adjust scope**

```bash
gh issue comment 4 --body "LinkedIn OAuth/API import is dropped: the API only returns identity fields, and full-profile access is partner-only/paid — no value-add for a free OSS project. Supported path is now: export your LinkedIn profile to PDF (profile → More → Save to PDF) and import via the PDF importer from #5. The import dialog documents these steps inline."
```

- [ ] **Step 2: Reference the PR against #5**

When opening the implementation PR, include `Closes #5` and `Closes #4` in the description.

---

## Self-Review Notes

- **Spec coverage:** PDF upload (T8/T10), text extraction (T7), structured mapping (T3/T8), preview before writes (T10), empty-only-fill + dedup merge (T5/T9), cert schema relaxation (T6), nested-role un-nesting (T3 prompt + T11 verification), date normalization (T2), error handling (T8), `unpdf` (T1/T7), ephemeral lifetime (no session table — T8→T10→T9 round-trip), Top-Skills→Skill (T5), entry point on profile page (T10), #4 docs/closeout (T10 dialog hint + T12). All spec sections map to a task.
- **Out of scope (per spec), intentionally absent:** DOCX, OCR, volunteering/awards/publications/recommendations, Top-Skills ordering, full field-by-field merge UI.
- **Type consistency:** `ExtractedProfile`/`ExtractedExperience`/`ExtractedActivity` (T3) flow unchanged through `buildCommitPlan` (T5), `commitImportedProfile` (T9), and the dialog (T10). `ExistingProfileState` (T5) — with `contact` (8 keys) and `summary` separated — is constructed identically in T5 tests and T9. `ExtractResult` (T8) and `CommitResult` (T9) are consumed verbatim in T10. `normalize` exported in T4 is used in T5 and T9. `LLMError.kind: LLMErrorKind` (T8) verified against `src/modules/llm/errors.ts`.
