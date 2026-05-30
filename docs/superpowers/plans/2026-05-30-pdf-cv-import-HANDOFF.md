# PDF CV Import — Session Handoff

**Date:** 2026-05-30
**Branch:** `feat/pdf-cv-import` (branched from `main` at the plan commit)

## What this feature is

Import a CV/resume **PDF** → LLM extraction → user reviews/deselects → commit to the
structured profile. Replaces the old plan to integrate LinkedIn's OAuth/API
(dropped: identity-only scopes, partner-only/paid for full profile, no value-add
for a free OSS project). Issues **#5** (PDF import) and **#4** (LinkedIn → now
"export to PDF and import here") are both covered by this one pipeline.

## Status: planning complete, implementation NOT started

### Done & committed (on `feat/pdf-cv-import`)
- `f35f189` — design spec: `docs/superpowers/specs/2026-05-30-pdf-cv-import-design.md`
- `198e032` — implementation plan: `docs/superpowers/plans/2026-05-30-pdf-cv-import.md`
- Branch `feat/pdf-cv-import` created and checked out.
- `.gitignore` now excludes `docs/samples/` (CV has PII — never commit it).

### Not done
- **No code written yet.** Task 1 (install `unpdf` + `vitest`, add config/scripts)
  was about to run but nothing executed. `npm install` has NOT been run.
- All 12 plan tasks remain open.

## How to execute (IMPORTANT — corrected approach)

**Execute the plan INLINE in the session. Do NOT spawn subagents.** We started
down the subagent-driven path but reverted: the harness guidance is that spawning
agents is the expensive path (each re-derives context already in hand), and it
should not be the default. Use the `superpowers:executing-plans` approach — work
the tasks directly with your own tools, TDD, frequent commits, checkpoint with
the user in batches.

The plan at `docs/superpowers/plans/2026-05-30-pdf-cv-import.md` is fully
self-contained: every task has exact file paths, complete code, and exact
commands. Follow it task by task.

## Verified facts (don't re-discover these)

- **No test runner exists.** Task 1 adds Vitest. Manual `@/` → `src/` alias needed
  in `vitest.config.ts` (codebase uses that alias everywhere).
- **No PDF parser installed** (only stray `@types/pdf-parse`). Plan uses `unpdf`.
- **`LLMError`** (`src/modules/llm/errors.ts`) exposes `.kind: LLMErrorKind` —
  Task 8 relies on this. Confirmed present.
- **LLM façade:** `completeStructured(profileId, prompt, zodSchema, opts)` from
  `src/modules/llm/client.ts`. BYO-key per user. `getLLMConfigStatus(profileId)`
  for the "is a key set?" check.
- **Profile page** `src/app/dashboard/profile/page.tsx` is a Server Component that
  renders inside `<ContentContainer title="Profile Page" fullWidth>` with
  `ContactBlock` / `QualificationsBlock` / `ExperienceBlock` / `ProfileSummaryCard`.
  Task 10 adds `<ImportProfileDialog />` as a right-aligned row just inside the
  container. (Plan Task 10 already reflects the real structure.)
- **shadcn components present** in `src/components/ui/`: dialog, button, input,
  checkbox, label (all Task 10 needs). No need to `shadcn add` anything.
- **Cert migration (Task 6):** `Certification.issuer` + `issueDate` → nullable.
  Needs Postgres up (`docker compose up -d`, port 5435) and
  `npm run db:migrate -- --name make_certification_issuer_date_optional`.
- **Existing patterns reused:** `normalize()` (Task 4 exports it from
  `src/modules/profile/duplicate-detect.ts`), the responsibility/achievement +
  impact activity convention from `profile/extract-schema.ts`, and the
  extract→review→commit three-beat from `extractFromNotes`/`acceptSuggestions`.
- **Plan fix already folded in:** `summary` lives at the top level of
  `ExtractedProfile`, NOT under `contact` — `buildCommitPlan` keeps the 8 contact
  keys and `summary` separate (Task 5 has a test for this).

## Benchmark / verification

- Sample CV: `docs/samples/devon-stanton_linkedin-profile.pdf` (gitignored, on disk,
  contains real PII — keep it untracked).
- Task 11 expects extraction to yield: **11 experiences across 6 companies**
  (Unity ×4, Blizzard ×1, 2K ×1, Megarom ×3, The Digital War Room ×1,
  Gamerlobby ×1), **3 education**, **5 certifications**, skills incl. AI Fluency /
  Marketing Operations / Online Branding. Critically: the company-level tenure
  totals ("5 years 3 months", "7 years 7 months") must NOT appear as roles.
- Task 11 needs Postgres up AND an LLM key saved at `/dashboard/settings/llm`
  (BYO key; the import calls it). Pure-logic tasks (2,3,5) and typechecks need
  neither.

## Task order (from the plan)

1. vitest + unpdf setup → 2. date-parse.ts → 3. schema.ts → 4. export normalize →
5. plan.ts (commit-plan builder) → 6. cert migration → 7. pdf.ts → 8. extract.ts →
9. commit.ts → 10. import dialog UI → 11. e2e verification (needs user/DB/key) →
12. close out #4/#5.

## Closeout

Task 12: comment on #4 (LinkedIn dropped, export-to-PDF path), and the PR should
say `Closes #5` and `Closes #4`.

## Note for whoever resumes

Several tool outputs this session showed **injected/spurious text** (fake commit
lines, a phantom "T16 placeholder" task, bogus file stats). Verify git/FS state
with plumbing commands; don't trust narrated tool output at face value. Current
true HEAD should be `198e032` on `feat/pdf-cv-import`; confirm with
`git log --oneline -3` and `git status` before starting.
