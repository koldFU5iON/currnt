# CV Builder — Design Spec
_Date: 2026-06-03_

## Overview

A job-tailored CV builder that reads a user's profile and a job description, uses an LLM to tailor the content toward the role, and presents the result as an inline block editor. CVs are stored as structured JSON documents and can be exported as PDF, Markdown, or plain text.

---

## Goals

- Generate a tailored, job-specific CV in one LLM call, grounded entirely in the user's real profile data
- Let users edit the output inline, block by block, without leaving the document view
- Support a "master" (generic) CV as a base, plus per-job CVs linked to a `JobApplication`
- Surface transferable skills where direct experience doesn't map exactly to the JD
- Provide PDF, Markdown, and per-section copy export from day one
- Stub entry points for ATS scoring (Phase 2) and AI discussion panel (Phase 2)

---

## Data Model

### CVDocument.generatedContent

The existing `CVDocument.generatedContent String` field stores a `CVDocumentContent` JSON value. No schema migration needed — the field already exists. All structure is enforced at the application layer via Zod.

```ts
// src/modules/cv/schema.ts

type HeaderData = {
  name: string
  headline: string
  subHeadline?: string          // optional
  contact: {
    email?: string
    phone?: string
    linkedin?: string
    website?: string
  }
}

type ProfileData      = { content: string }             // Markdown
type CompetenciesData = { items: string[] }
type CapabilitiesData = { items: string[] }

type ExperienceData = {
  company: string
  titles: string[]              // array handles promotions
  location: string
  duration: string
  description: string           // Markdown
  outcomes: string[]            // Markdown bullets
}

type EducationData = {
  institution: string
  qualification: string
  field?: string
  duration: string
  grade?: string
}

type CertificationData = {
  name: string
  issuer?: string
  date?: string
  url?: string
}

type SkillsData    = { items: string[] }
type ToolsData     = { items: string[] }
type LanguagesData = { items: Array<{ name: string; proficiency: string }> }

type CVSection =
  | { id: string; type: "header";        visible: boolean; data: HeaderData }
  | { id: string; type: "profile";       visible: boolean; data: ProfileData }
  | { id: string; type: "competencies";  visible: boolean; data: CompetenciesData }
  | { id: string; type: "capabilities";  visible: boolean; data: CapabilitiesData }
  | { id: string; type: "experience";    visible: boolean; data: ExperienceData }
  | { id: string; type: "education";     visible: boolean; data: EducationData }
  | { id: string; type: "certification"; visible: boolean; data: CertificationData }
  | { id: string; type: "skills";        visible: boolean; data: SkillsData }
  | { id: string; type: "tools";         visible: boolean; data: ToolsData }
  | { id: string; type: "languages";     visible: boolean; data: LanguagesData }

type CVDocumentContent = {
  version: 1
  sections: CVSection[]
}
```

**Prose fields** (`ProfileData.content`, `ExperienceData.description`, `ExperienceData.outcomes[]`) accept Markdown. The renderer uses `react-markdown` to parse them. The LLM prompt instructs sparse use of bold/italic for emphasis.

**Hiding a section** sets `visible: false` — the data is preserved and the section can be restored. Hidden sections appear as ghost rows in the editor and in the right-rail section map.

### CVDocument relationship to jobs

| Scenario | `jobApplicationId` |
|---|---|
| Master / generic CV | `null` |
| Job-specific CV | set to `JobApplication.id` |

One job can have at most one active CV document (enforced in the create action).

### Job list query change

`listJobs` includes the CV document ID so each row knows whether a CV exists:

```ts
cvDocuments: { select: { id: true }, take: 1 }
// mapped to: job.cvDocumentId = cvDocuments[0]?.id ?? null
```

The `Job` type gains `cvDocumentId?: string | null`. No schema migration.

---

## Module Structure

```
src/modules/cv/
  schema.ts       Zod schemas for CVDocumentContent and all section types
  queries.ts      getCV(id, profileId), listCVs(profileId)
  actions.ts      createCV, updateSection, toggleVisibility, reorderSections, deleteCV
  generate.ts     LLM one-shot generation → CVDocumentContent
  export.ts       toMarkdown(doc), toText(doc)
```

Follows the same conventions as `src/modules/onboarding/` — `queries.ts` for reads, `actions.ts` for Server Actions/mutations, `schema.ts` for Zod types.

---

## Routing

```
/dashboard/cv-builder                       List all CVs (master + job-linked)
/dashboard/cv-builder/new                   Create: choose generic or pick a job
/dashboard/cv-builder/new?jobId=[id]        Pre-selects a job, triggers generation
/dashboard/cv-builder/[id]                  Inline editor
```

---

## Entry Points from Job List

### AppControls dropdown (`src/components/app-item-menu.tsx`)

A new item is added to the "File Management" group:

- **No CV exists** → "Generate CV" (`FileText` icon) → navigates to `/dashboard/cv-builder/new?jobId=[id]`
- **CV exists** → "View CV" (`FileText` icon) → navigates to `/dashboard/cv-builder/[cvId]`

The item is conditionally rendered based on `job.cvDocumentId`.

### Job row title cell (`job-row.tsx`)

A small `FileText` icon appears inline next to the job title when `job.cvDocumentId` is set — same link as "View CV". Mirrors the existing `SquareArrowOutUpRight` external-link icon pattern.

---

## Generation Flow

Triggered by navigating to `/dashboard/cv-builder/new?jobId=[id]` or clicking "Generate" on the new CV screen.

1. **Input assembly** (server action)
   - Full profile: experiences + role activities, competencies, skills, education, certifications, tools, languages
   - Job description text from `JobApplication.jobDescription` — omitted for generic CVs; the prompt switches to "best-foot-forward" mode: include all experiences, highlight breadth over fit
   - Default section order from `CVTemplate`

2. **Prompt loading**
   - `src/lib/prompts/writing-rules.md` — shared writing rules (loaded at runtime)
   - `src/lib/prompts/cv-generate.md` — CV-specific system prompt (loaded at runtime)
   - Both injected into the LLM system message

3. **LLM call**
   - `completeStructured(profileId, userMessage, CVDocumentContentSchema, { feature: 'cv-generate' })`
   - Response parsed through Zod; failure throws `LLMError` with `kind: 'parse'`
   - The LLM selects which experiences to include and tailors language toward the JD
   - Never invents content not present in the profile

4. **Persist**
   - `CVDocument` created (or updated) with `generatedContent = JSON.stringify(result)`, `status = "draft"`

5. **Redirect**
   - User lands on `/dashboard/cv-builder/[id]` — the inline editor

**Regeneration**: the toolbar "↺ Regenerate" button repeats steps 1–4 and overwrites `generatedContent`. A confirmation dialog warns that manual edits will be discarded.

---

## LLM Prompt Files

### `src/lib/prompts/cv-generate.md`

```markdown
# CV Generation

You are a CV writer. Your job is to tailor the candidate's real experience
toward a target job description.

## Rules
- Never invent experience, skills, or outcomes not present in the profile data
- Weave in keywords from the job description naturally — do not keyword-stuff
- Use Markdown (bold, italic) sparingly for emphasis in prose fields
- Order experiences most-recent first
- Omit a section entirely if the profile has no relevant data for it

## Transferable skills
Where the candidate's direct experience doesn't map exactly to the job description,
surface transferable skills and adjacent experience that demonstrate relevant capability.
Be explicit — name the transferable skill and briefly connect it to the requirement.
Do not overreach; only make connections that are genuinely defensible from the profile data.

## Output
Return a valid CVDocumentContent JSON object matching the schema provided.
```

Prompt files are loaded from disk at runtime and injected into the LLM system message. They can be edited without touching TypeScript. When a settings UI for prompt editing is added, these files are the source of truth.

---

## Editor UI

### Layout

```
┌─────────────────────────────────────────────────────┐
│ Toolbar: [title · status] [↺ Regenerate] [⤓ Export] [💬 Discuss] │
├──────────────────────────────────────┬──────────────┤
│                                      │ Sections     │
│   CV Document (inline editor)        │ ☰ Header     │
│                                      │ ☰ Profile    │
│   ┌──────────────────────────────┐   │ ☰ Experience │
│   │ BLOCK (active — editing)     │   │ ⊘ Languages  │
│   │  field inputs visible        │   │              │
│   └──────────────────────────────┘   │ + Add section│
│                                      │              │
│   ┌──────────────────────────────┐   │ ░░░░ ATS     │
│   │ BLOCK (idle — hover shows    │   │ Run analysis │
│   │ ✎edit ⊘hide ⎘copy controls) │   │ (Phase 2)    │
│   └──────────────────────────────┘   │              │
│                                      │              │
│   ░░░░░░░ hidden block (ghost) ░░░   │              │
└──────────────────────────────────────┴──────────────┘
```

### Block interactions

| Action | How |
|---|---|
| Edit | Click "✎ edit" → fields expand inline below the rendered content |
| Hide | Click "⊘ hide" → `visible: false`, block becomes a ghost row |
| Show | Click "⊕ show" on ghost row → `visible: true` |
| Copy section | Click "⎘ copy" → serialises block to plain text, writes to clipboard |
| Reorder | Drag handle in right-rail section map (Phase 2) |

### Toolbar actions

| Button | Behaviour |
|---|---|
| ↺ Regenerate | Confirmation dialog → re-runs generation, overwrites content |
| ⤓ Export | Dropdown: Download PDF (print), Download Markdown, Download Text |
| 💬 Discuss | Opens slide-over chat panel (stub in Phase 1) |

---

## Export

| Format | Mechanism |
|---|---|
| PDF | `window.print()` with `@media print` CSS — hides toolbar, rail, block controls, hidden sections |
| Markdown | `export.ts toMarkdown()` → blob download |
| Plain text | `export.ts toText()` → blob download (strips Markdown markers) |
| Copy section | Clipboard API, per-block button |

---

## Phase 2 Entry Points (stubs in Phase 1)

### 💬 Discuss panel
- Toolbar button opens a slide-over panel
- When implemented: LLM chat with `CVDocumentContent` + `jobDescription` as context
- Users ask questions like "Is this experience framing right for this role?"
- Feature tag: `cv-discuss`

### ATS Strength Indicator (Issue #86)
- Reserved panel in right rail below section map
- Phase 1: "Run analysis →" button, no logic
- Phase 2: `completeStructured` call → `{ score: number, suggestions: Suggestion[] }`
  - `Suggestion: { sectionId: string, issue: string, suggestion: string }`
  - Score + suggestions stored on `CVDocument` (new fields: `atsScore Int?`, `atsSuggestions Json?`)
  - Feature tag: `cv-ats-score`
  - Score refreshes (debounced) after each block edit

---

## What This Does Not Cover

- Cover letter generation (existing `CoverLetterDocument` model handles that separately)
- Multi-template switching after generation
- Real-time collaborative editing
- ATS score implementation (Phase 2 — Issue #86)
- Discuss panel implementation (Phase 2)
- Drag-to-reorder sections (Phase 2)
- Settings UI for prompt editing (future)
