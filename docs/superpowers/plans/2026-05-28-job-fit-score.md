# Job Fit Score — Display Overhaul + Context-Aware Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hidden flame icon with an always-visible badge pill, extend the LLM scoring to incorporate the user's onboarding career goals, and surface a two-section popover with fit + trajectory narrative.

**Architecture:** Extend `JobFitSchema` with an optional `trajectoryNote` field, feed onboarding context into the `assessJobFit` prompt, redesign the `JobFit` component as a badge pill with an expanded popover, and thread a `hasLLMKey` boolean from server components down to disable the assess button when no key is configured.

**Tech Stack:** Next.js 16 App Router, Better Auth, Prisma 7, Tailwind CSS v4, shadcn/ui (Popover, Separator), Zod, Lucide icons

---

## File Map

| File | Change |
|---|---|
| `src/app/types/job-application.ts` | Add `trajectoryNote?: string` to `JobFit` type |
| `src/modules/jobs/schema.ts` | Add `trajectoryNote` to `JobFitSchema` |
| `src/modules/jobs/job-fit.ts` | Fetch onboarding context, extend prompt with Career Goals block |
| `src/app/dashboard/job-applications/_components/job-fit.tsx` | Full redesign: badge pill, cold/blue for poor, expanded two-section popover, `hasLLMKey` prop |
| `src/app/dashboard/job-applications/page.tsx` | Fetch `getLLMConfigStatus`, pass `hasLLMKey` to `JobList` |
| `src/app/dashboard/job-applications/_components/job-list.tsx` | Accept + thread `hasLLMKey` to `JobGroup` |
| `src/app/dashboard/job-applications/_components/job-group.tsx` | Accept + thread `hasLLMKey` to `JobRow` |
| `src/app/dashboard/job-applications/_components/job-row.tsx` | Accept + pass `hasLLMKey` to `JobFit` |
| `src/app/dashboard/job-applications/view/[id]/page.tsx` | Fetch `getLLMConfigStatus`, pass `hasLLMKey` to `JobStatsGrid` |
| `src/app/dashboard/job-applications/view/[id]/_components/job-stats-grid.tsx` | Add Fit cell with `JobFit` component |

---

## Task 1: Extend the JobFit type and Zod schema

**Files:**
- Modify: `src/app/types/job-application.ts`
- Modify: `src/modules/jobs/schema.ts`

- [ ] **Step 1: Update the JobFit type in `src/app/types/job-application.ts`**

Replace the existing `JobFit` type (lines 75–79):

```ts
export type JobFit = {
  rating: number
  label: "poor" | "ok" | "stretch" | "good" | "excellent"
  justification: string
  trajectoryNote?: string
}
```

- [ ] **Step 2: Add `trajectoryNote` to `JobFitSchema` in `src/modules/jobs/schema.ts`**

Add one field to `JobFitSchema` after `justification`:

```ts
export const JobFitSchema = z.object({
  rating: z.number().min(0).max(10).describe('Overall fit score, 0 = no match, 10 = perfect match.'),
  label: z.enum(['poor', 'ok', 'stretch', 'good', 'excellent'])
    .describe('Bucketed verdict. "stretch" = could land it with effort; "good" = strong baseline match.'),
  justification: z.string().min(1)
    .describe('Two or three sentences. Concrete reasoning grounded in candidate and role specifics, no fluff.'),
  trajectoryNote: z.string().optional()
    .describe("One or two sentences on how this role relates to the candidate's stated career goals and target direction. Omit entirely when no career goals are provided."),
})
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/types/job-application.ts src/modules/jobs/schema.ts
git commit -m "feat: add trajectoryNote field to JobFit schema and type"
```

---

## Task 2: Extend assessJobFit to inject onboarding context

**Files:**
- Modify: `src/modules/jobs/job-fit.ts`

- [ ] **Step 1: Add onboarding imports to `src/modules/jobs/job-fit.ts`**

Add after the existing imports:

```ts
import { normalizeOnboardingContext, onboardingContextHasContent } from '@/modules/onboarding/schema'
```

- [ ] **Step 2: Fetch onboarding context and extend the prompt**

Replace the entire `assessJobFit` function body with the updated version:

```ts
export async function assessJobFit(jobId: string): Promise<AssessJobFitResult> {
  const { profile } = await requireProfile()

  const job = await prisma.jobApplication.findFirst({
    where: { id: jobId, profileId: profile.id },
    select: { id: true, title: true, company: true, jobDescription: true },
  })
  if (!job) {
    return { ok: false, error: 'not_found', message: 'Job not found' }
  }
  if (!job.jobDescription?.trim()) {
    return {
      ok: false,
      error: 'no_description',
      message: 'Add a job description first — assessment needs it to score against.',
    }
  }

  const [snapshot, settings] = await Promise.all([
    buildProfileSnapshot(profile.id),
    prisma.userSettings.findUnique({
      where: { profileId: profile.id },
      select: { onboardingContext: true },
    }),
  ])

  const context = normalizeOnboardingContext(settings?.onboardingContext)
  const hasGoals = onboardingContextHasContent(context)

  const system = `You are an experienced career coach assessing whether a candidate is a strong fit for a role.

Be honest and concrete. Overclaiming the candidate's fit makes them waste an interview slot; understating loses them an opportunity they could land. Calibrate the rating against real-world hiring bars:

- 0–2 (poor): missing core requirements; would be rejected at first screen.
- 3–4 (ok): partial overlap; would need an exceptional cover letter to advance.
- 5–6 (stretch): meets most requirements but has a meaningful gap; viable with strong story.
- 7–8 (good): strong baseline match; can credibly compete in interviews.
- 9–10 (excellent): unusually well-aligned across role, level, and stack.

Ground your justification in specific evidence from both sides — name technologies, scope, level — rather than generic praise.${hasGoals ? '\n\nWhen a # Career Goals section is provided, populate trajectoryNote with one or two sentences on how this role aligns or diverges from the candidate\'s stated direction. Omit the field entirely when no goals are provided.' : ''}`

  let userPrompt = `# Candidate

${serializeProfileForLLM(snapshot)}

# Role

**${job.title}** at ${job.company}

${job.jobDescription}`

  if (hasGoals) {
    userPrompt += '\n\n# Career Goals\n'
    if (context.targetRole)      userPrompt += `\n**Target role:** ${context.targetRole}`
    if (context.industries)      userPrompt += `\n**Industries:** ${context.industries}`
    if (context.workPreferences) userPrompt += `\n**Work preferences:** ${context.workPreferences}`
    if (context.extraContext)    userPrompt += `\n**Additional context:** ${context.extraContext}`
  }

  userPrompt += `\n\nReturn a single JSON object matching the schema. Two or three sentences in the justification${hasGoals ? '; one or two sentences in trajectoryNote' : ''}.`

  let fit: JobFit
  try {
    const result = await completeStructured(profile.id, userPrompt, JobFitSchema, {
      system,
      maxOutputTokens: 600,
      temperature: 0.2,
    })
    fit = result.object
  } catch (err) {
    if (err instanceof LLMError) {
      return { ok: false, error: err.kind, message: err.message }
    }
    throw err
  }

  await prisma.jobApplication.update({
    where: { id: jobId },
    data: { jobFit: fit, jobFitAssessedAt: new Date() },
  })

  revalidatePath('/dashboard/job-applications')
  revalidatePath(`/dashboard/job-applications/view/${jobId}`)

  return { ok: true, fit }
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/jobs/job-fit.ts
git commit -m "feat: inject onboarding career goals into job-fit scoring prompt"
```

---

## Task 3: Redesign the JobFit component

**Files:**
- Modify: `src/app/dashboard/job-applications/_components/job-fit.tsx`

- [ ] **Step 1: Replace the entire file content**

```tsx
'use client'

import { useState, useTransition } from "react"
import { Flame, Loader2, Sparkles } from "lucide-react"
import Link from "next/link"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import type { JobFit as JobFitType } from "@/app/types/job-application"
import { assessJobFit } from "@/modules/jobs/job-fit"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type JobFitProps = {
  jobId?: string
  jobFit: JobFitType | null
  canAssess?: boolean
  hasLLMKey?: boolean
}

const FLAME_STYLES: Record<JobFitType['label'], string> = {
  poor:      'fill-blue-400 text-blue-400',
  ok:        'fill-amber-200 text-amber-300',
  stretch:   'fill-amber-400 text-amber-500',
  good:      'fill-orange-500 text-orange-600',
  excellent: 'fill-red-500 text-red-600',
}

const PILL_TEXT_STYLES: Record<JobFitType['label'], string> = {
  poor:      'text-blue-400',
  ok:        'text-amber-300',
  stretch:   'text-amber-500',
  good:      'text-orange-600',
  excellent: 'text-red-600',
}

export function JobFit({ jobId, jobFit, canAssess = true, hasLLMKey = true }: JobFitProps) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  // Display-only context (e.g. no jobId passed)
  if (!jobId) {
    if (!jobFit) return <div className="h-6 w-16" />
    return <FitPill fit={jobFit} />
  }

  function handleAssess() {
    if (!jobId || isPending) return
    startTransition(async () => {
      const result = await assessJobFit(jobId)
      if (result.ok) {
        setOpen(true)
      } else {
        toast.error(result.message, {
          action: result.error === 'not_configured'
            ? { label: 'Set up', onClick: () => { window.location.href = '/dashboard/settings/llm' } }
            : undefined,
        })
      }
    })
  }

  if (isPending) {
    return (
      <div className="inline-flex h-6 items-center gap-1.5 px-2 text-xs text-muted-foreground" aria-live="polite">
        <Loader2 className="size-3 animate-spin" />
        Assessing...
      </div>
    )
  }

  if (!jobFit) {
    const disabled = !hasLLMKey || !canAssess
    const title = !hasLLMKey
      ? 'Add an LLM API key in Settings to assess fit'
      : !canAssess
        ? 'Add a job description first'
        : 'Assess fit'

    return (
      <button
        type="button"
        onClick={handleAssess}
        disabled={disabled}
        title={title}
        aria-label={title}
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground/60 transition-colors",
          disabled
            ? "cursor-not-allowed opacity-40"
            : "hover:bg-muted hover:text-foreground cursor-pointer",
        )}
      >
        <Sparkles size={12} />
        assess
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Fit: ${jobFit.label}, ${jobFit.rating} out of 10. Click for details.`}
        className="rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FitPill fit={jobFit} />
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-sm font-semibold capitalize">{jobFit.label}</p>
              <span className="font-mono text-xs text-muted-foreground">{jobFit.rating}/10</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{jobFit.justification}</p>
          </div>

          {jobFit.trajectoryNote && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold mb-1.5">Your trajectory</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{jobFit.trajectoryNote}</p>
              </div>
            </>
          )}

          <Separator />

          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI assessments can be wrong — trust your gut.{' '}
              <Link href="/dashboard/career-profile" className="underline underline-offset-2 hover:text-foreground transition-colors">
                Update your profile
              </Link>
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleAssess() }}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              <Sparkles size={11} />
              Re-assess
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function FitPill({ fit }: { fit: JobFitType }) {
  return (
    <span className={cn(
      "inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium",
      PILL_TEXT_STYLES[fit.label],
    )}>
      <Flame size={12} className={FLAME_STYLES[fit.label]} />
      {fit.label}
    </span>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/job-applications/_components/job-fit.tsx
git commit -m "feat: redesign JobFit as badge pill with trajectory section and no-key guard"
```

---

## Task 4: Thread hasLLMKey through the job list component chain

**Files:**
- Modify: `src/app/dashboard/job-applications/page.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-list.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-group.tsx`
- Modify: `src/app/dashboard/job-applications/_components/job-row.tsx`

- [ ] **Step 1: Update `page.tsx` to fetch LLM config status**

Replace the entire file:

```tsx
import { JobList } from "./_components/job-list"
import { getActiveJobs } from "@/modules/jobs/queries"
import { ContentContainer } from "@/app/components/ContentContainer"
import { requireProfile } from "@/lib/session"
import { getLLMConfigStatus } from "@/modules/llm/client"

export default async function Page() {
  const [jobs, { profile }] = await Promise.all([
    getActiveJobs(),
    requireProfile(),
  ])
  const { configured: hasLLMKey } = await getLLMConfigStatus(profile.id)

  return (
    <ContentContainer title="Job Applications" description="Track all the jobs you're currently interested in. Update the status to keep up to date on the current process and where you stand with your application">
      <JobList jobs={jobs} hasLLMKey={hasLLMKey} />
    </ContentContainer>
  )
}
```

- [ ] **Step 2: Add `hasLLMKey` prop to `JobList`**

In `src/app/dashboard/job-applications/_components/job-list.tsx`, update the component signature and pass the prop to `JobGroup`:

Change the `JobList` function signature (line 36):
```tsx
export function JobList({ jobs, hasLLMKey }: { jobs: Job[]; hasLLMKey: boolean }) {
```

In the `groups.map(...)` block inside the JSX, add `hasLLMKey` to `JobGroup`:
```tsx
<JobGroup
  key={g.key}
  label={g.label}
  jobs={g.jobs}
  defaultCollapsed={g.defaultCollapsed}
  selected={selected}
  busyRows={busyRows}
  onToggleSelect={toggleSelect}
  onEdit={setEditing}
  onArchive={handleSingleArchive}
  hasLLMKey={hasLLMKey}
/>
```

- [ ] **Step 3: Add `hasLLMKey` prop to `JobGroup`**

In `src/app/dashboard/job-applications/_components/job-group.tsx`, update the type and thread the prop:

```tsx
type JobGroupProps = {
  label: string | null
  jobs: Job[]
  selected: Set<string>
  busyRows: Map<string, string>
  onToggleSelect: (id: string) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  defaultCollapsed?: boolean
  hasLLMKey: boolean
}

export function JobGroup({
  label,
  jobs,
  selected,
  busyRows,
  onToggleSelect,
  onEdit,
  onArchive,
  defaultCollapsed = false,
  hasLLMKey,
}: JobGroupProps) {
```

And pass it to `JobRow`:
```tsx
<JobRow
  key={job.id}
  job={job}
  selected={selected.has(job.id)}
  busyLabel={busyRows.get(job.id)}
  onToggleSelect={onToggleSelect}
  onEdit={onEdit}
  onArchive={onArchive}
  hasLLMKey={hasLLMKey}
/>
```

- [ ] **Step 4: Add `hasLLMKey` prop to `JobRow`**

In `src/app/dashboard/job-applications/_components/job-row.tsx`, update `JobRowProps` and pass to `JobFit`:

```tsx
type JobRowProps = {
  job: Job
  selected: boolean
  busyLabel?: string
  onToggleSelect: (id: string) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  hasLLMKey: boolean
}

export function JobRow({ job, selected, busyLabel, onToggleSelect, onEdit, onArchive, hasLLMKey }: JobRowProps) {
```

And in the `JobFit` usage:
```tsx
<JobFit
  jobId={id}
  jobFit={jobFit || null}
  canAssess={!!jobDescription?.trim()}
  hasLLMKey={hasLLMKey}
/>
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/job-applications/page.tsx \
        src/app/dashboard/job-applications/_components/job-list.tsx \
        src/app/dashboard/job-applications/_components/job-group.tsx \
        src/app/dashboard/job-applications/_components/job-row.tsx
git commit -m "feat: thread hasLLMKey through job list to disable assess when no key configured"
```

---

## Task 5: Add Fit cell to the job detail page

**Files:**
- Modify: `src/app/dashboard/job-applications/view/[id]/page.tsx`
- Modify: `src/app/dashboard/job-applications/view/[id]/_components/job-stats-grid.tsx`

- [ ] **Step 1: Update the detail page to fetch LLM config status**

Replace the entire file at `src/app/dashboard/job-applications/view/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation"
import { getJobApplicationById } from "@/modules/jobs/queries"
import { requireProfile } from "@/lib/session"
import { getLLMConfigStatus } from "@/modules/llm/client"
import { JobDetailHeader } from "./_components/job-detail-header"
import { JobStatsGrid } from "./_components/job-stats-grid"
import { JobDetailsCard } from "./_components/job-details-card"

export default async function ViewJobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [job, { profile }] = await Promise.all([
    getJobApplicationById(id),
    requireProfile(),
  ])

  if (!job) {
    notFound()
  }

  const { configured: hasLLMKey } = await getLLMConfigStatus(profile.id)

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <JobDetailHeader job={job} />
        <JobStatsGrid job={job} hasLLMKey={hasLLMKey} />
        <JobDetailsCard job={job} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Fit cell to `JobStatsGrid`**

Replace the entire file at `src/app/dashboard/job-applications/view/[id]/_components/job-stats-grid.tsx`:

```tsx
import { Badge } from "@/components/ui/badge"
import { type Job } from "@/app/types/job-application"
import { formatDate } from "@/lib/utils"
import { JobFit } from "@/app/dashboard/job-applications/_components/job-fit"

interface Props {
  job: Job
  hasLLMKey: boolean
}

export function JobStatsGrid({ job, hasLLMKey }: Props) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-5">
      <MetaCell label="Status">
        <Badge variant="secondary" className="w-fit capitalize">{job.status}</Badge>
      </MetaCell>
      <MetaCell label="Progress">
        <span className="text-sm font-medium capitalize">{job.progress}</span>
      </MetaCell>
      <MetaCell label="Applied">
        <span className="text-sm font-medium">{formatDate(job.dateApplied) ?? "Not recorded"}</span>
      </MetaCell>
      <MetaCell label="Last updated">
        <span className="text-sm font-medium">{formatDate(job.lastUpdated) ?? "—"}</span>
      </MetaCell>
      <MetaCell label="Fit">
        <JobFit
          jobId={job.id}
          jobFit={job.jobFit ?? null}
          canAssess={!!job.jobDescription?.trim()}
          hasLLMKey={hasLLMKey}
        />
      </MetaCell>
    </div>
  )
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/dashboard/job-applications/view/[id]/page.tsx' \
        'src/app/dashboard/job-applications/view/[id]/_components/job-stats-grid.tsx'
git commit -m "feat: add Fit cell to job detail stats grid"
```

---

## Verification

After all tasks are complete:

1. `npm run dev` → navigate to `/dashboard/job-applications`
2. Rows with no LLM key show disabled `✦ assess` pill with tooltip "Add an LLM API key in Settings to assess fit"
3. Rows with a key but no description show disabled `✦ assess` pill with tooltip "Add a job description first"
4. Rows with a key + description show enabled `✦ assess` pill
5. Click assess → spinner → fit badge pill appears (flame + label)
6. `poor` label renders in blue, `excellent` in red
7. Click the badge → popover opens with label, rating, justification
8. For a user with onboarding context filled in, popover shows "Your trajectory" section below a divider
9. For a user with no onboarding context, "Your trajectory" section is absent
10. Footer shows disclaimer with "Update your profile" link to `/dashboard/career-profile`
11. Navigate to `/dashboard/job-applications/view/[id]` → stats grid shows 5 cells including Fit
12. Fit cell on detail page is fully interactive (assess, popover, re-assess)
