# Interview Prep — Design Spec

**Date:** 2026-06-08
**Status:** Draft
**Phase:** 4 of the candidate journey (Profile → CV → Cover Letter → Interview Prep)

---

## Overview

A war-room workspace where a candidate consolidates everything they need to prepare for an interview: reference documents, interviewer profiles, and their own prep notes — all in one place. AI is available throughout as an optional enhancement layer; the workspace is fully functional without it.

Interview Prep is a standalone route (`/dashboard/interview-prep`), following the same list → workspace pattern as CV Builder and Cover Letters. Sessions can optionally link to a job application to pull in role and company context, but this is not required.

---

## Data Model

Three new Prisma models, all scoped to `profileId` for ownership.

### `InterviewPrepSession`

The root entity. Stores session metadata and the entire block array for the left-pane notes editor.

```prisma
model InterviewPrepSession {
  id               String    @id @default(cuid())
  profileId        String
  title            String
  company          String?
  jobTitle         String?
  jobApplicationId String?
  sections         Json      @default("[]")   // ordered Block array
  status           String    @default("draft") // draft | active | archived
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  profile        Profile              @relation(fields: [profileId], references: [id], onDelete: Cascade)
  jobApplication JobApplication?      @relation(fields: [jobApplicationId], references: [id])
  documents      PrepDocument[]
  interviewers   PrepInterviewer[]

  @@index([profileId])
  @@index([jobApplicationId])
}
```

### `PrepDocument`

A reference document attached to a session. Content is stored as extracted text (no file blob needed in v1 — paste or client-side PDF extraction). AI analysis is stored alongside the source content.

```prisma
model PrepDocument {
  id           String    @id @default(cuid())
  sessionId    String
  profileId    String
  name         String
  docType      String    @default("other")  // interview-pack | company-doc | other
  content      String                       // extracted/pasted text
  aiAnalysis   Json?                        // AI-generated insights keyed to candidate profile
  aiAnalysedAt DateTime?
  createdAt    DateTime  @default(now())

  session InterviewPrepSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}
```

### `PrepInterviewer`

One card per interviewer. LinkedIn profile content is pasted or uploaded and stored as text. AI analysis surfaces who they are, what they value, and how the candidate's background connects to them.

```prisma
model PrepInterviewer {
  id            String    @id @default(cuid())
  sessionId     String
  profileId     String
  name          String
  role          String?
  linkedInText  String?                      // pasted/extracted LinkedIn profile
  notes         String?                      // free-form user notes about this person
  aiAnalysis    Json?                        // background, likely questions, what they value, candidate fit
  aiAnalysedAt  DateTime?
  createdAt     DateTime  @default(now())

  session InterviewPrepSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}
```

### Block schema (TypeScript, not Prisma)

`InterviewPrepSession.sections` is a `Json` column storing an ordered array of blocks. Validated with Zod on read/write.

```ts
// src/modules/interview-prep/schema.ts

const TextBlockSchema = z.object({
  id: z.string(),
  type: z.literal('text'),
  title: z.string(),
  content: z.string(),
  order: z.number(),
})

const AiAnalysisBlockSchema = z.object({
  id: z.string(),
  type: z.literal('ai-analysis'),
  title: z.string(),
  content: z.string(),
  sourceDocIds: z.array(z.string()).default([]),         // PrepDocument IDs that fed this block
  sourceInterviewerIds: z.array(z.string()).default([]), // PrepInterviewer IDs that fed this block
  order: z.number(),
})

const QaBankBlockSchema = z.object({
  id: z.string(),
  type: z.literal('qa-bank'),
  title: z.string(),
  content: z.string(), // markdown-formatted Q&A bank
  order: z.number(),
})

const BlockSchema = z.discriminatedUnion('type', [TextBlockSchema, AiAnalysisBlockSchema, QaBankBlockSchema])
export type Block = z.infer<typeof BlockSchema>
export const SectionsSchema = z.array(BlockSchema)
```

**Future block type** (schema supports it without migration):
- `transcript` — interview transcript or post-interview notes

---

## Module Architecture

```
src/modules/interview-prep/
  schema.ts        — Zod schemas and TypeScript types (Block, Session, Document, Interviewer)
  queries.ts       — read-only DB queries (getSession, listSessions, getDocuments, getInterviewers)
  actions.ts       — Server Actions: CRUD for sessions, blocks, documents, interviewers; block reorder
  ai-actions.ts    — AI Server Actions (all optional): analyseDocument, analyseInterviewer, analyseAllDocuments
```

The AI actions follow the same `complete` / `completeStructured` pattern as the rest of the LLM layer, with required `feature` tags:

| Action | Feature label |
|---|---|
| Analyse a document | `interview-prep-doc-analysis` |
| Analyse an interviewer profile | `interview-prep-interviewer-analysis` |
| Analyse all documents (bulk) | `interview-prep-bulk-analysis` |
| Generate Q&A bank (future) | `interview-prep-qa-generation` |

Add all four to `FEATURE_LABELS` in the usage log component.

---

## Route Structure

```
src/app/dashboard/interview-prep/
  page.tsx                         — session list (mirrors /cover-letters)
  new/page.tsx                     — create session form (title, company, job title, optional job link)
  [id]/
    page.tsx                       — workspace shell (split panel layout)
    _components/
      prep-workspace.tsx           — root workspace: left + right pane composition
      notes-panel.tsx              — left pane: block index sidebar + block list
      block-editor.tsx             — individual editable block (title + markdown textarea)
      block-index.tsx              — sticky index sidebar (block titles, click to scroll)
      reference-panel.tsx          — right pane: tab shell
      documents-tab.tsx            — document list, upload/paste, per-doc AI analysis
      interviewers-tab.tsx         — interviewer cards, LinkedIn paste, AI profile analysis
      qa-tab.tsx                   — Q&A bank (lower priority, generated on demand)
```

---

## Workspace UI

### Layout

Full-height split panel, same viewport strategy as the cover letter workspace.

```
┌──────────────────────────────────────────────────────────────┐
│ Interview Prep — Senior Product Designer @ Acme Corp    [⋯]  │
├─────────────────────────────────┬────────────────────────────┤
│  [Index]  │  Block editor       │  Docs │ Interviewers │ Q&A │
│           │                     │                            │
│  Key      │  ## Key Themes      │  📄 Interview Pack         │
│  Themes   │  - Systems thinking │     [View] [✦ Analyse]     │
│           │                     │                            │
│ ✦ Doc     │  ✦ Doc Insights     │  📄 Design Values          │
│  Insights │  (AI block)         │     [View] [✦ Analyse]     │
│           │                     │                            │
│  My Qs    │  ## My Questions    │  ✦ AI Insight (card)       │
│           │  - What does...     │  Acme runs a 4-stage...    │
│           │                     │                            │
│  5 blocks │  [+ Text] [✦ AI]   │  [✦ Analyse all docs]      │
└───────────┴─────────────────────┴────────────────────────────┘
```

### Left pane — Notes editor

- Narrow index sidebar (fixed, ~140px) listing block titles. Clicking scrolls to that block.
- Block list: each block shows its title (editable inline) and a markdown textarea for content.
- Block header bar: title | ↑ up | ↓ down | ⋯ menu (rename, delete).
- AI-analysis blocks are visually distinguished (accent left border, `✦` prefix in index, read-only by default). The ⋯ menu includes a "Convert to text block" option that strips the AI metadata and makes the content fully editable.
- Footer: `+ Text block` and `✦ AI block` buttons.
- No drag-and-drop in v1 — up/down arrow reorder only.

### Right pane — Reference panel (tabbed)

**Documents tab**
- List of uploaded/pasted documents with name, type badge, and two actions: View (expands content inline) and `✦ Analyse` (AI — inserts an ai-analysis block into the left pane referencing this document's ID).
- Upload area at the bottom: paste text or upload a file. V1 supports text paste and PDF (text extraction consistent with the existing PDF import approach in the codebase). Content stored as extracted plain text in `PrepDocument.content` — the original file is not retained.
- `✦ Analyse all documents` button at the tab footer — generates one AI block per document in a single operation.

**Interviewers tab**
- One card per `PrepInterviewer`. Shows name, role, and a collapsed LinkedIn/notes area.
- `✦ Analyse` button on each card: AI reads the LinkedIn text + candidate's profile → generates an ai-analysis block titled with the interviewer's name, covering: background, what they likely care about, questions they tend to ask, and how the candidate's experience connects.
- `+ Add interviewer` at the bottom.

**Q&A tab**
- Lower priority. Placeholder in v1 with a `✦ Generate questions` button.
- When triggered: AI uses session context (job title, company, all documents, interviewer profiles) to generate a question bank organised by interview stage (screening / competency / technical / final).
- Stored as a `qa-bank` block in the sections array — appears in the left pane index so it can be navigated to and reordered.

---

## AI Behaviour

All AI actions are user-triggered — no automatic generation. AI is unavailable if the user has no LLM key configured (same gate as the rest of the app).

**Document analysis prompt context:**
- Candidate's profile summary (experience, skills)
- Full document text
- Session title/company/role
- Task: surface insights that are specifically relevant to *this candidate* for *this role*. Ignore generic boilerplate.

**Interviewer analysis prompt context:**
- Candidate's profile summary
- Interviewer's LinkedIn/notes text
- Session role/company
- Task: who is this person, what do they value, what questions are they likely to ask, where does the candidate's background connect — be specific.

**Bulk document analysis:**
- Runs `analyseDocument` sequentially for each document that hasn't been analysed yet.
- Each result is a separate ai-analysis block in sections, so they can be reordered independently.

---

## Session Creation

`/dashboard/interview-prep/new` — a simple form:
- **Title** (required) — free text, e.g. "Senior Product Designer @ Acme Corp"
- **Company** (optional)
- **Job title** (optional)
- **Link to job** (optional) — typeahead over the user's job applications. If selected, auto-fills Company and Job title from the job record.

Job link can also be added or changed later from the workspace header menu (`⋯`).

---

## Out of Scope (v1)

- Drag-and-drop block reordering (v2)
- File blob storage — documents stored as extracted text only (v2 can add Vercel Blob)
- Export to PDF
- Transcript upload / in-app recording (future phase)
- Q&A bank answer workspace with per-question AI refinement (future phase — described in the product vision but lower priority)
- Sharing or exporting prep sessions
