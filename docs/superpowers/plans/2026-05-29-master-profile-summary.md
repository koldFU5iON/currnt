# Master Profile Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a master professional summary field to the user's profile — writable manually or AI-generated from profile data — as the canonical source for future CV tailoring.

**Architecture:** One new `summary String?` field on the `Profile` model. A mutation persists it. A separate server action generates it via the existing LLM layer (`complete()` + `serializeProfileForLLM()`). A client component on the career profile page provides the write/generate/save UI.

**Tech Stack:** Next.js 16 App Router, Prisma 7, TypeScript strict, shadcn/ui, Lucide React, Sonner toasts, existing LLM layer (`src/modules/llm/client.ts`)

---

## File map

| File | Action |
|------|--------|
| `prisma/schema/profile.prisma` | Add `summary String?` to `Profile` |
| `src/modules/profile/actions.ts` | Add `updateProfileSummary(summary)` |
| `src/modules/profile/generate-summary.ts` | Create — `generateProfileSummary()` server action |
| `src/app/dashboard/profile/_components/ProfileSummaryCard.tsx` | Create — write/generate/save UI |
| `src/app/dashboard/profile/page.tsx` | Add `ProfileSummaryCard` to layout |

---

### Task 1: Schema migration — add `summary` to `Profile`

**Files:**
- Modify: `prisma/schema/profile.prisma`

- [ ] **Step 1: Add the field**

In `prisma/schema/profile.prisma`, add `summary String?` after the `headline String?` line:

```prisma
model Profile {
  id        String   @id @default(cuid())
  userId    String   @unique
  name      String
  email     String?
  phone     String?
  location  String?
  website   String?
  linkedIn  String?
  github    String?
  headline  String?
  summary   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user            User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  skills          Skill[]
  experiences     Experience[]
  projects        Project[]
  educations      Education[]
  certifications  Certification[]
  cvDocuments     CVDocument[]
  coverLetters    CoverLetterDocument[]
  jobApplications JobApplication[]
  competencies    Competency[]
  languages       Language[]
  settings        UserSettings?
  apiTokens       ApiToken[]
}
```

- [ ] **Step 2: Run the migration**

```bash
npm run db:migrate -- --name add_profile_summary
```

Expected: migration file created in `prisma/migrations/`, Prisma Client regenerated.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors. The `Profile` Prisma type now includes `summary: string | null`, which flows into `FullProfile` automatically (it's defined as `Profile & {...}` in `src/app/types/profile.ts`).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema/profile.prisma prisma/migrations/
git commit -m "feat: add summary field to Profile"
```

---

### Task 2: `updateProfileSummary` mutation

**Files:**
- Modify: `src/modules/profile/actions.ts`

- [ ] **Step 1: Add the function**

In `src/modules/profile/actions.ts`, add `updateProfileSummary` after the existing `updateContactField` function (around line 15). The file starts with `'use server'` — all exports must be async functions.

```ts
export async function updateProfileSummary(summary: string) {
  const { profile } = await requireProfile()
  await prisma.profile.update({
    where: { id: profile.id },
    data: { summary: summary.trim() || null },
  })
  revalidatePath('/dashboard/profile')
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/profile/actions.ts
git commit -m "feat: add updateProfileSummary mutation"
```

---

### Task 3: `generateProfileSummary` server action

**Files:**
- Create: `src/modules/profile/generate-summary.ts`

- [ ] **Step 1: Create the file**

```ts
'use server'

import { requireProfile } from '@/lib/session'
import { buildProfileSnapshot, serializeProfileForLLM } from '@/modules/profile/snapshot'
import { complete } from '@/modules/llm/client'
import { LLMError, type LLMErrorKind } from '@/modules/llm/errors'

type GenerateSummaryResult =
  | { ok: true; summary: string }
  | { ok: false; error: LLMErrorKind; message: string }

export async function generateProfileSummary(): Promise<GenerateSummaryResult> {
  const { profile } = await requireProfile()
  const snapshot = await buildProfileSnapshot(profile.id)

  const system = `You are an experienced CV writer. Write professional summaries that are specific, honest, and compelling. Use first person. Return only the summary paragraph — no heading, no preamble, no extra commentary.`

  const userPrompt = `Write a concise professional summary of 3–4 sentences for this candidate. Ground it in their actual experience and skills — no generic filler.\n\n${serializeProfileForLLM(snapshot)}`

  try {
    const result = await complete(profile.id, userPrompt, {
      system,
      maxOutputTokens: 200,
      temperature: 0.4,
    })
    return { ok: true, summary: result.text.trim() }
  } catch (err) {
    if (err instanceof LLMError) {
      return { ok: false, error: err.kind, message: err.message }
    }
    throw err
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/profile/generate-summary.ts
git commit -m "feat: add generateProfileSummary server action"
```

---

### Task 4: `ProfileSummaryCard` component

**Files:**
- Create: `src/app/dashboard/profile/_components/ProfileSummaryCard.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useState, useTransition } from "react"
import { Sparkles } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { updateProfileSummary } from "@/modules/profile/actions"
import { generateProfileSummary } from "@/modules/profile/generate-summary"
import { toast } from "sonner"

type ProfileSummaryCardProps = {
  initialSummary: string | null
  hasLLMKey: boolean
}

export function ProfileSummaryCard({ initialSummary, hasLLMKey }: ProfileSummaryCardProps) {
  const [saved, setSaved] = useState(initialSummary ?? '')
  const [draft, setDraft] = useState(saved)
  const [isSaving, startSaving] = useTransition()
  const [isGenerating, startGenerating] = useTransition()

  const isDirty = draft !== saved
  const isPending = isSaving || isGenerating

  function handleSave() {
    startSaving(async () => {
      try {
        await updateProfileSummary(draft)
        setSaved(draft.trim())
        setDraft(draft.trim())
        toast.success('Summary saved.')
      } catch {
        toast.error('Failed to save summary. Please try again.')
      }
    })
  }

  function handleGenerate() {
    startGenerating(async () => {
      const result = await generateProfileSummary()
      if (result.ok) {
        setDraft(result.summary)
        toast.success('Summary generated — review and save when ready.')
      } else {
        toast.error(result.message, {
          action: result.error === 'not_configured'
            ? { label: 'Set up', onClick: () => { window.location.href = '/dashboard/settings/llm' } }
            : undefined,
        })
      }
    })
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="Write a professional summary, or generate one from your profile…"
        rows={5}
        disabled={isPending}
        className="resize-none text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={hasLLMKey ? handleGenerate : undefined}
          disabled={isPending || !hasLLMKey}
          title={!hasLLMKey ? 'Add an LLM API key in Settings to generate a summary' : undefined}
        >
          <Sparkles size={13} className="mr-1.5" />
          {isGenerating ? 'Generating…' : 'Generate from profile'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={isPending || !isDirty}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/profile/_components/ProfileSummaryCard.tsx
git commit -m "feat: add ProfileSummaryCard component"
```

---

### Task 5: Wire `ProfileSummaryCard` into the profile page

**Files:**
- Modify: `src/app/dashboard/profile/page.tsx`

- [ ] **Step 1: Update the page**

The current page (`src/app/dashboard/profile/page.tsx`) imports `getFullProfile` and renders three blocks. Replace the entire file with:

```tsx
import { ContentContainer } from "@/app/components/ContentContainer"
import { ExperienceBlock } from "./_components/Experience"
import { getFullProfile } from "@/modules/profile/queries"
import { ContactBlock } from "./_components/Contact"
import { QualificationsBlock } from "./_components/Qualifications"
import { ProfileSummaryCard } from "./_components/ProfileSummaryCard"
import { getLLMConfigStatus } from "@/modules/llm/client"
import type { FullProfile } from "@/app/types/profile"

export type QualificationsType = {
  skills: FullProfile['skills']
  education: FullProfile['educations']
  certifications: FullProfile['certifications']
  tools: FullProfile['languages']
}

export default async function Page() {
  const profile = await getFullProfile()
  const { configured: hasLLMKey } = await getLLMConfigStatus(profile.id)

  const contact = {
    name: profile.name,
    phone: profile.phone ?? undefined,
    email: profile.email ?? undefined,
    site: profile.website ?? undefined,
    profile: profile.linkedIn ?? undefined,
    location: profile.location ?? undefined,
  }

  const currentYear = new Date().getFullYear()
  const earliestYear = profile.experiences.length > 0
    ? Math.min(...profile.experiences.map(e => e.startDate.getFullYear()))
    : currentYear - 10
  const careerYears = Math.max(currentYear - earliestYear, 1)

  const qualifications = {
    skills: profile.skills,
    education: profile.educations,
    certifications: profile.certifications,
    tools: profile.languages,
  }

  return (
    <ContentContainer title="Profile Page" fullWidth>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div>
          {contact.name && <ContactBlock contact={contact} />}
        </div>
        <div className="md:col-span-2">
          <QualificationsBlock qualifications={qualifications} careerYears={careerYears} />
        </div>
      </div>
      <div className="mb-8">
        <p className="text-sm font-semibold mb-3">Professional Summary</p>
        <ProfileSummaryCard
          initialSummary={profile.summary ?? null}
          hasLLMKey={hasLLMKey}
        />
      </div>
      <ExperienceBlock exp={profile.experiences} />
    </ContentContainer>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/profile/page.tsx
git commit -m "feat: add Professional Summary section to profile page"
```

---

## Manual verification

Start the dev server (`npm run dev`) and verify:

1. Navigate to `/dashboard/profile` — a "Professional Summary" section appears below the contact/qualifications row, above experiences.
2. Type in the textarea and click **Save** — toast "Summary saved." appears. Reload the page — text persists.
3. Clear the text and save — field clears (stored as null). Reload confirms it's gone.
4. With an LLM key configured: click **Generate from profile** — button shows "Generating…", result populates the textarea. Summary is not saved until clicking **Save**.
5. Without an LLM key: "Generate from profile" button is disabled with tooltip.
6. Save button is disabled when text matches what's saved (not dirty).
