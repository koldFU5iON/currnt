# PDF CV Import — Design Spec

**Date:** 2026-05-30
**Issues:** #5 (Import and merge profile data from uploaded CV/resume), #4 (LinkedIn import — repurposed)
**Status:** Approved for planning

## Summary

Add a feature that lets a user upload a CV/resume **PDF**, have its content
extracted into the app's structured profile model, review and edit the result,
and commit it to their profile. One source (PDF), one well-built pipeline.

LinkedIn import via OAuth/API is **dropped**. LinkedIn's standard OAuth only
returns identity fields (name, email, picture, locale); full work history
requires partner-only API products that carry cost and approval friction with no
value-add for a free OSS project. Instead, #4 is repurposed: ship short docs
telling users to export their LinkedIn profile as a PDF (LinkedIn profile →
**More → Save to PDF**) and feed that file through the same PDF importer. Zero
integration code.

## Scope decisions (settled during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Import source | **PDF only** | Drops LinkedIn API cost/risk; one adapter done well |
| Primary scenario | **Empty-profile first** | Optimizes the onboarding case; dupe-aware so re-import is safe, but no per-field conflict UI |
| Certifications with no issuer/date | **Relax schema** — `Certification.issuer` + `issueDate` nullable | Without this, zero LinkedIn certs import |
| "Top Skills" | Map to `Skill`, drop ordering | Skill is the right home; ordering is YAGNI for v1 |
| Entry point | **Button on `/dashboard/profile`** | One discoverable place; onboarding can link later |
| PDF parser | **`unpdf`** | Modern, maintained, serverless/Next-16-friendly, ESM-native, no native binaries |
| Parsed-data lifetime | **Ephemeral** (no DB session) | Matches existing `extractFromNotes` → `acceptSuggestions` pattern |

## Benchmark document

`docs/samples/devon-stanton_linkedin-profile.pdf` — a real, well-populated
LinkedIn-exported PDF. Used as the extraction baseline and the basis for test
fixtures. It exercises every hard case below.

## Field mapping: LinkedIn PDF → schema

### Clean maps
| PDF content | Schema target |
|---|---|
| Name | `Profile.name` |
| Headline ("Senior Program Manager \| …") | `Profile.headline` |
| City/region line ("Le Chesnay, Île-de-France, France") | `Profile.location` |
| Email, phone, LinkedIn URL | `Profile.email` / `phone` / `linkedIn` |
| Summary paragraph | `Profile.summary` |
| Role bullets | `RoleActivity` (responsibility/achievement + impact) |
| Role intro paragraph | `Experience.summary` (markdown prose) |
| Education entries | `Education` |

### Hard cases the design must handle
1. **Company-grouped nested roles.** LinkedIn lists a company with a total
   tenure ("Unity — 5 years 3 months") then N positions beneath it (Unity has 4,
   Megarom 2). Must emit one `Experience` per role, repeating the company, and
   must **not** treat the company total as any role's dates.
2. **Date normalization.** "July 2024 - Present", "(2012 - 2012)", "(1997 -
   2001)". `Experience.startDate` and `Education.startDate` are **required**, so
   every entry must resolve to a real `Date`. "Present" → `endDate = null`.

### Flagged fields (no clean schema home)
| PDF content | Problem | Resolution |
|---|---|---|
| Certifications (Custom Reporting, React Skill Path, Learn SQL, Revenue Operations, Claude Code 101) | `Certification` requires `issuer` + `issueDate`; PDF gives neither | **Relax schema** (migration) |
| "Top Skills" (AI Fluency, Marketing Operations, Online Branding) | LinkedIn curates + orders; no "top/ordered" concept | Map to `Skill`, drop ordering |
| Street address ("1 Square Raphael…") | More PII than wanted; single `location` field | Ignore; use city/region line |
| Volunteering, Honors/Awards, Publications, Recommendations, Courses (common, not in sample) | No models exist | Out of scope for v1; noted for later |

## Architecture

New module `src/modules/profile-import/`, keeping import logic out of the
already-large `profile/actions.ts`:

```
src/modules/profile-import/
  pdf.ts          extractPdfText(bytes): unpdf wrapper. Pure, swappable seam.
  schema.ts       Zod ExtractedProfile + types. Plain module (no 'use server').
  extract.ts      'use server' extractProfileFromPdf(formData)
  commit.ts       'use server' commitImportedProfile(payload)
  date-parse.ts   "July 2024" | "(1997 - 2001)" | "Present" → Date | null
```

UI: `src/app/dashboard/profile/_components/ImportProfileDialog.tsx` — button on
the profile page → upload → `extractProfileFromPdf` → editable review list →
`commitImportedProfile`.

**Data flow:**
`PDF file → extractPdfText → completeStructured (LLM) → ExtractedProfile →
[client review/edit in React state] → commitImportedProfile → Prisma
$transaction → profile populated`.

This is the same three-beat the codebase already uses for experience notes
(`extractFromNotes` → client review → `acceptSuggestions`): **extract with no
writes → review in client state → commit transactionally**. New source (PDF vs
textarea), wider schema (whole profile vs one role's activities).

## Extraction schema (`schema.ts`)

```ts
ExtractedProfile = {
  contact: {
    name, headline, location, email, phone, linkedIn, website, github
  }                                   // all nullable
  summary: string | null
  experiences: ExtractedExperience[]
  education: ExtractedEducation[]
  certifications: ExtractedCertification[]
  skills: ExtractedSkill[]           // includes "Top Skills"; ordering dropped
}

ExtractedExperience = {
  company: string
  role: string
  startDate: string | null           // "YYYY-MM"; null only if truly absent
  endDate: string | null             // null = "Present"
  location: string | null
  remote: boolean
  summary: string | null             // the role's intro paragraph
  activities: {
    kind: 'responsibility' | 'achievement'
    description: string
    impact: string | null
  }[]
}

ExtractedEducation = {
  institution: string
  qualification: string
  field: string | null
  startDate: string | null           // "YYYY"
  endDate: string | null
}

ExtractedCertification = {
  name: string
  issuer: string | null
  issueDate: string | null
}

ExtractedSkill = {
  name: string
  category: string | null
}
```

Design notes:
- **Nested-role unflattening lives in the prompt, not in code.** The schema is a
  flat `experiences[]`; the system prompt instructs the model to un-nest
  company-grouped roles and ignore company-level tenure totals.
- **Activities reuse the existing responsibility/achievement + impact
  convention** from `profile/extract-schema.ts`, so the model has a known-good
  rubric ("Scaled 40 → 5,000+ tracked projects" = achievement with impact).
- **Dates stay strings out of the LLM**, normalized centrally in
  `date-parse.ts` — not by the model, not by Prisma.
- **Loose array constraints** (no min/max), matching the existing extraction
  schema: a slightly-off count must not trigger a paid retry.
- Extraction runs through the existing BYO-key LLM façade
  (`completeStructured(profileId, prompt, schema, opts)`), low temperature.

## Commit semantics (`commit.ts`)

```
commitImportedProfile(payload):
  requireProfile()                         // writes scoped to profile.id
  one prisma.$transaction:
    - update Profile contact/summary fields ONLY where currently empty
      (never clobber user-authored values)
    - create experiences (+ nested activities), education, certifications, skills
    - skip any experience whose company+role already exists
      (reuse duplicate-detect normalize()), making re-import safe
  revalidatePath('/dashboard/profile')
```

"Don't silently overwrite" (from #5) is satisfied by: (a) contact fields only
fill blanks, (b) the client review screen lets the user deselect/edit any entry
before commit, and (c) duplicate experiences are skipped, not duplicated.

## Schema migration

Single migration: make `Certification.issuer` and `Certification.issueDate`
nullable. Existing rows unaffected.

## Error handling

`extractProfileFromPdf` returns a discriminated union
`{ ok: true, data } | { ok: false, error, message }`, matching the codebase
convention. Cases:

- `not_pdf` / oversized (cap ~10MB)
- `no_text` — scanned/image-only PDF (no OCR in v1; guide user to a text PDF or
  manual entry)
- `not_configured` — no LLM key → link to `/dashboard/settings/llm`
- normalized `LLMError` kinds → reuse existing messages; never partial-write

## Testing

- **`date-parse.ts`** — pure unit tests: every format in the sample CV, "Present",
  year-only ranges, and garbage input.
- **`schema.ts` / extraction** — run a captured text dump of the sample PDF
  through a mocked `completeStructured`; assert correct un-nesting: 11 roles
  across 6 companies, 3 education entries, 5 certifications, correct
  responsibility/achievement split.
- **`commit.ts`** — empty profile fills correctly; populated profile skips
  duplicate experiences and preserves existing contact fields.

## Out of scope for v1 (noted for later)

- DOCX and plain-text/Markdown sources
- OCR / scanned-image PDFs
- Volunteering, Honors/Awards, Publications, Recommendations, Courses (need new models)
- "Top Skills" ordering / curation
- Full field-by-field merge & conflict-resolution UI (issue #5's heavier variant)
- LinkedIn OAuth/API import (#4 → docs only: export profile to PDF, import here)
