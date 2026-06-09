# Chat Assistant — Design Spec

**Date:** 2026-06-09
**Status:** Draft
**Branch:** feature/chat-assistant

---

## Overview

A persistent career coaching assistant that lives in the right-hand panel of the dashboard. It knows the user's profile, remembers past sessions, and stays aware of what the user is currently working on. The coach helps with profile completeness, surfaces hidden impact in the user's experience, guides interview preparation, and can read and propose edits to any document in the workspace — with the user confirming before anything is applied.

The assistant is focused on career topics: profile building, job search, interview prep, and company research. It does not act as a general-purpose assistant.

---

## Approach: Tool-Native Coach

A lean system prompt (profile overview + recency-decayed memory + breadcrumbs + active context) is sent each turn. When the LLM needs more detail it calls a read tool; when it wants to make a change it emits a write tool call that surfaces a confirmation card in the UI. The user accepts or rejects before anything is applied. This keeps token costs bounded while enabling real actions.

The AI SDK's `streamText` with `tools` handles the tool-call/response loop automatically and streams tokens in parallel.

---

## Memory Architecture

Three sources compose the system prompt at session start. Total budget: ~800 tokens.

### ① Profile Overview — always fresh (≤ 300 tokens)

Compiled from DB at session start. Never stored — always reflects current state.

- Full name, headline, location
- Career goals and job search targets (from `onboardingContext`)
- Top 5 skills by proficiency
- Current employment status and most recent role
- Active application count + any in-progress interview prep sessions

### ② Session Summaries — recency-decayed (≤ 400 tokens total)

Up to 4 past sessions loaded from `ChatMemory`, oldest trimmed first. Each summary is ≤ 150 tokens.

| Age | Treatment |
|-----|-----------|
| < 7 days | Full summary included |
| 7–30 days | Trimmed to key facts |
| 30–60 days | First sentence only |
| > 60 days | Excluded |

Summaries are generated at session end by a background `POST /api/chat/summarize` call. Two triggers, both client-side: the panel's close handler, and a 10-minute idle timer (reset on each user message). Uses `complete()` with `feature: 'chat-summarize'`.

### ③ Breadcrumbs — situational awareness (≤ 100 tokens)

Cheap DB query at session start:

- Applications in `interviewing` or `screening` status
- Open interview prep sessions
- Current page / injected artifact (filled in by `PageContextProvider`, not here)

---

## Context Injection

A `PageContextProvider` wraps the dashboard shell. It owns `chatOpen` state and exposes `setContext()` + `openPanel()` to any page in the tree. This eliminates prop drilling — entry points call both in one place.

`AppShell` reads `chatOpen` from the context instead of owning it.

### Entry Points

| Location | Trigger | Context injected |
|----------|---------|-----------------|
| Job fit card | "Ask a question" button | `{type:'job_fit', jobId, company, fitScore, jdSnippet}` |
| CV builder workspace | "Discuss" button (already stubbed) | `{type:'cv', cvId, title, company}` |
| Cover letter workspace | "Ask coach" button | `{type:'cover_letter', letterId, company}` |
| Interview prep workspace | "Ask coach" button | `{type:'interview_prep', sessionId, company, role}` |

For job-fit, the JD snippet and score are injected directly into the context object so the LLM can respond immediately without a tool call. For larger artifacts (CV JSON, prep notes), only a reference is included — the LLM fetches full content via tool if the conversation needs it.

### PageContext Type

```typescript
type PageContext =
  | { type: 'cv'; cvId: string; title: string; company?: string }
  | { type: 'job_fit'; jobId: string; company: string; fitScore: number; jdSnippet: string }
  | { type: 'cover_letter'; letterId: string; company?: string }
  | { type: 'interview_prep'; sessionId: string; company?: string; role?: string }
  | null
```

Context clears via a `useEffect` cleanup when the component that called `setContext()` unmounts — i.e. when the user navigates away from the originating page.

---

## Tool Registry

Tools are defined in `src/modules/chat/tools.ts` using the AI SDK tool format.

### Read Tools — auto-execute, no confirmation

| Tool | Description |
|------|-------------|
| `get_profile_section` | Returns detailed data for a profile section: `skills`, `experience`, `projects`, `education`, or `certifications` |
| `get_job_application` | Returns job application details including full JD, fit score, and notes |
| `get_cv_document` | Returns full CV JSON for a given `cvId` |
| `get_cover_letter` | Returns cover letter content for a given `letterId` |
| `get_interview_prep` | Returns prep session notes, documents, and interviewer profiles |

### Write Tools — surface confirmation card, user accepts/rejects

| Tool | Description |
|------|-------------|
| `propose_profile_update` | Proposes a change to a profile field. Payload includes `section`, `field`, `currentValue`, `proposedValue`, `rationale` |
| `propose_cv_update` | Proposes a change to a CV section. Payload includes `cvId`, `sectionId`, `proposedContent`, `rationale` |
| `propose_prep_note_update` | Proposes a change to a prep note block. Payload includes `sessionId`, `noteId`, `blockId`, `proposedContent` |

Write tools do not execute server-side. The LLM emits the tool-call event; the client renders a confirmation card with the diff; only after user acceptance does the client call the relevant mutation API route.

---

## Coaching Persona & Topic Guardrails

The base system prompt (compiled in `src/modules/chat/context.ts`) opens with a persona directive:

> You are a focused career coach embedded in the user's job search workspace. Your role is to help them build a compelling profile, surface achievements they may undervalue, prepare for interviews, and evaluate job fit. Keep all conversations within the scope of career, job search, profile building, interview preparation, and company research. If asked about unrelated topics, acknowledge briefly and redirect warmly back to their career goals.

This is a prompt-level constraint, not a code-level block. Users are on BYO keys so costs land on them — but the persona keeps the assistant on-topic for the vast majority of interactions.

---

## Per-Chat Model Selector

Users can choose a different model for chat sessions, separate from their global default (used for CV generation, cover letters, etc.). A chat-specific model is often worth the upgrade — coaching benefits from stronger reasoning and longer context awareness.

- Dropdown in the chat panel header, populated from `availableModels` in `UserSettings` (already stored by the dynamic model discovery feature)
- Selection persists as `chatModel` on `UserSettings`
- The stream route prefers `chatModel` over the user's global `llmModel` when set
- Defaults to the user's global model if `chatModel` is not set

---

## Conversation Persistence

- **Within a session:** React state via `useChat` hook — ephemeral, never written to DB.
- **Across sessions:** Session summaries in `ChatMemory`, decayed by recency (see Memory Architecture above).
- **No full history storage.** The user's applications, CVs, and prep notes are already in the DB — the assistant reads those via tools rather than duplicating them in chat history.

---

## Streaming

The current LLM layer uses `generateText` (non-streaming). The chat route adds `streamText` alongside it. The existing `complete()` and `completeStructured()` functions are unchanged — the stream endpoint is a separate route that calls `streamText` directly and returns an AI SDK data stream response.

The client uses the `useChat` hook from `ai/react`, which handles:
- Message state
- Token streaming
- Tool call / result lifecycle
- Optimistic updates

---

## Data Model

### New: `ChatMemory`

```prisma
model ChatMemory {
  id        String   @id @default(cuid())
  profileId String
  summary   String   // compact text, ≤150 tokens
  createdAt DateTime @default(now())

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
}
```

### Modified: `UserSettings`

Add `chatModel String?` — the user's preferred model for chat sessions. `null` means "use global default."

---

## File Map

### New files

```
prisma/schema/chat.prisma

src/modules/chat/
  memory.ts          — load summaries with decay, save summary to ChatMemory
  context.ts         — compile system prompt (overview + summaries + breadcrumbs + page ctx)
  tools.ts           — AI SDK tool definitions (read + write)
  schema.ts          — PageContext union type, tool I/O Zod schemas

src/app/api/chat/
  stream/route.ts    — POST: streamText with tool registry, returns data stream
  summarize/route.ts — POST: summarize session messages, save to ChatMemory

src/lib/context/page-context.tsx   — PageContextProvider + usePageContext hook

src/components/shell/
  chat-message.tsx              — renders a single message (user / assistant / tool states)
  tool-confirmation-card.tsx    — diff UI for write tool proposals
```

### Modified files

```
prisma/schema/settings.prisma         — add chatModel field to UserSettings
src/components/shell/chat-panel.tsx   — replace stub with useChat implementation + model selector
src/components/shell/app-shell.tsx    — read chatOpen from PageContextProvider
src/app/dashboard/layout.tsx          — wrap with PageContextProvider
src/app/dashboard/jobs/[id]/          — "Ask a question" button on job-fit card
src/app/dashboard/cv-builder/[id]/    — wire "Discuss" button (already stubbed in spec)
src/app/dashboard/cover-letter/[id]/  — "Ask coach" button
src/app/dashboard/interview-prep/[id]/ — "Ask coach" button
src/app/dashboard/settings/llm/       — add chat model selector field
src/app/dashboard/settings/usage/     — add 'chat-turn' and 'chat-summarize' to FEATURE_LABELS
```

---

## Error Handling

- **LLM not configured:** Panel shows "Add an API key in Settings to use the assistant" with a link. No API call made.
- **Tool call fails:** Error surfaced inline in the message thread ("Couldn't load your experience — try again"). Conversation continues.
- **Write tool rejected by user:** Tool result sent back to LLM as `{status: 'rejected'}` so it can acknowledge and offer alternatives.
- **Summarization fails:** Swallowed silently — a missing summary is better than a broken close flow.
- **Stream interrupted:** `useChat` handles reconnect automatically; if it fails, a "Something went wrong" message appears with a retry option.

---

## LLM Usage Tracking

Two new feature labels in `FEATURE_LABELS` (`usage-log.tsx`):

| Feature key | Label |
|-------------|-------|
| `chat-turn` | Chat (career coach) |
| `chat-summarize` | Chat summary |

The stream route logs usage via `after()` once the stream completes, consistent with existing LLM call patterns.
