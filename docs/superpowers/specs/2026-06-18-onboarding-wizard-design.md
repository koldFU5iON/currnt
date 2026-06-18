# Onboarding wizard — design spec

**Date:** 2026-06-18
**Issue:** #273 — Redesign onboarding around fast value, BYO LLM setup, and progressive profile enrichment
**Related:** #21 (job-fit score tracking), #217 (LLM context optimisation), #123 (career archetype — future)

---

## Context

The current "onboarding" is a redirect from `/dashboard/onboarding` to `/dashboard/search-context` — a plain form with no wizard, no CV import prompt, no LLM key guidance, and no activation tracking. New users land in the product with no direction.

This spec replaces that with a full 4-step wizard focused on getting users to a meaningful first action as quickly as possible.

---

## Goals

- Get a new user oriented and into the product with minimal friction
- Introduce the BYO AI model transparently, without making it a blocker
- Populate the career profile via LinkedIn import (preferred) or CV upload
- Land the user at a meaningful first action (track a job or find roles)
- Show the wizard to every user who hasn't completed it, regardless of sign-up date

---

## Architecture

### Route structure

New `(onboarding)` route group, mirroring the existing `(auth)` pattern:

```
src/app/(onboarding)/
  layout.tsx          — centered full-page layout, no sidebar or nav chrome
  onboarding/
    page.tsx          — server component; loads initial state, renders WizardShell
```

The wizard URL is `/onboarding`. The URL does not change between steps — step state is managed client-side in `WizardShell`.

The `/onboarding` page server component also checks the inverse: if `onboardingCompletedAt` is already set, it redirects to `/dashboard`. This prevents an already-onboarded user from navigating back to the wizard directly.

### Layout

The `(onboarding)/layout.tsx` renders a centred card on a plain background with:
- The Currnt wordmark at top
- A 4-segment progress bar beneath the logo (fills as steps complete)
- The step content below

Aesthetically matches the `(auth)` sign-in/sign-up pages.

### Dashboard guard

`src/app/dashboard/layout.tsx` gains a server-side check at the top:

```ts
const settings = await getUserSettings(profile.id)
if (!settings.onboardingCompletedAt && !settings.onboardingSkippedAt) {
  redirect('/onboarding')
}
```

This replaces the per-page `searchProfileHasContent` redirect currently in `dashboard/page.tsx` (which is removed).

The proxy (`src/proxy.ts`) is unchanged — it only checks session auth, which is correct.

### Wizard state

`WizardShell` is a `'use client'` component holding:
- `currentStep: 0 | 1 | 2 | 3` — which step is shown
- Any transient in-progress form values

No step position is persisted to the database. If a user abandons mid-wizard and returns, they restart at step 1. This is safe because every step write is idempotent — previously saved data surfaces immediately (key-saved badge, profile summary card, etc.).

### Completion

Step 4 has three options; clicking any one:
1. Fires the `completeOnboarding()` server action → sets `UserSettings.onboardingCompletedAt = now()`
2. Redirects to the chosen destination

`UserSettings.onboardingCompletedAt` and `onboardingSkippedAt` already exist in the schema — no migration required.

### Modules touched

| File | Change |
|------|--------|
| `src/app/(onboarding)/layout.tsx` | New |
| `src/app/(onboarding)/onboarding/page.tsx` | New |
| `src/app/(onboarding)/onboarding/_components/WizardShell.tsx` | New |
| `src/app/(onboarding)/onboarding/_components/steps/Step1Ai.tsx` | New |
| `src/app/(onboarding)/onboarding/_components/steps/Step2Profile.tsx` | New |
| `src/app/(onboarding)/onboarding/_components/steps/Step3Context.tsx` | New |
| `src/app/(onboarding)/onboarding/_components/steps/Step4Start.tsx` | New |
| `src/modules/onboarding/actions.ts` | Add `completeOnboarding()` server action |
| `src/app/dashboard/layout.tsx` | Add onboarding guard redirect |
| `src/app/dashboard/page.tsx` | Remove `searchProfileHasContent` redirect |

---

## Step-by-step UX

All steps are skippable. The wizard always completes (reaches step 4 and the user clicks an option) — there is no global dismiss button.

### Step 1 — AI setup

**Headline:** "Make Currnt work harder for you"
**Subline:** "Connect your own AI provider — costs land on your account, not ours. You can always update this in Settings."

**Content:**

Three provider cards (radio-style selection, single choice):
- **Anthropic** — "Claude — strong reasoning & long context"
- **OpenAI** — "GPT-4 — widely tested"
- **Google Gemini** — "Gemini — multimodal"

Below the selected provider: a dynamic link "Don't have a key? Generate one on the [Provider] console →" pointing to:
- Anthropic → `https://console.anthropic.com/keys`
- OpenAI → `https://platform.openai.com/api-keys`
- Google → `https://aistudio.google.com/app/apikey`

API key input field (password + show/hide toggle + save button) — identical to the existing `LLMSettingsForm` input group. Fires `saveLLMApiKey({ provider, apiKey })` on save.

Model selector: locked ("Save a key first") until the key saves successfully. On save, `saveLLMApiKey` returns the model list; the first model is auto-selected and saved via `saveLLMModel`. User can change the selection before continuing.

Once key + model are set: "Continue →" primary CTA appears.

**Skip:** "Skip for now — I'll set this up in Settings later" — always visible, advances to step 2 with no writes.

**Reuses:** `saveLLMApiKey`, `saveLLMModel`, `refreshModels` from `src/modules/llm/actions.ts`.

---

### Step 2 — Build your profile

**Headline:** "Let's build your profile"
**Subline:** "Import your experience so Currnt can score job fit and tailor your applications. LinkedIn gives the best results."

**Content:**

Two import options stacked vertically:

**LinkedIn (preferred — shown prominently with branded border):**
"Go to LinkedIn → Me → Settings → Data Privacy → Get a copy of your data → select Profile. Upload the zip here."
Drop zone for the LinkedIn export zip.

**Upload a CV (PDF — secondary, muted styling):**
"Quality varies — we'll do our best."
Drop zone for a PDF file.

**Re-entry state:** If the profile already has experience rows (user previously imported or abandoned mid-wizard), step 2 shows a summary card instead of drop zones:
> "5 roles and 12 skills already imported. Continue to the next step, or re-import to replace."
Two actions: "Continue" and "Re-import".

**Skip:** "Skip — I'll build my profile manually" — advances to step 3 with no writes.

**Reuses:** existing `src/modules/profile-import/` extract/commit pipeline.

---

### Step 3 — Search context

**Headline:** "What are you looking for?"
**Subline:** "Pre-filled from your profile where we could. Update anything that's off — this guides job-fit scoring and role suggestions."

**Fields:** Target role, Current role, Industries, Work preferences.

Pre-population: the server component derives initial values from the imported profile where possible and passes them as props. Only `currentRole` is reliably derivable — it is inferred from the title of the user's most recent Experience row. `targetRole`, `industries`, and `workPreferences` cannot be inferred from history and start blank.

**CTAs:** "Save & continue" (primary) and "Skip for now" (link).

**Reuses:** existing `saveSearchProfile` server action.

---

### Step 4 — First action

**Headline:** "You're set — where do you want to start?"
**Subline:** "Pick a starting point. You can always switch from the dashboard."

Three action cards:

| Option | Destination | Style |
|--------|-------------|-------|
| 📋 Track a job | `/dashboard/job-applications` | Primary (indigo border) |
| 🔍 Find roles | `/dashboard/job-hunt` | Secondary |
| 🏠 Go to dashboard | `/dashboard` | Secondary |

All three fire `completeOnboarding()` then redirect. There is no "skip" on this step — all three options are valid completions.

---

## Data flow

| Step | DB writes on completion | DB writes on skip |
|------|------------------------|-------------------|
| 1 — LLM key | `llmApiKey` (encrypted), `llmProvider`, `availableModels`, `llmModel` | none |
| 2 — LinkedIn | Profile + Experience + Skill rows | none |
| 2 — CV | Profile + Experience + Skill rows (partial) | none |
| 3 — Search context | `UserSettings.searchProfile` | none |
| 4 — any option | `UserSettings.onboardingCompletedAt` | n/a (no skip on step 4) |

Each write happens immediately on the step's action, not batched at the end. This means partial progress is preserved if the user abandons and returns.

---

## Error handling

**Step 1 — invalid API key:** `saveLLMApiKey` throws an `LLMError`. Caught in the step component, shown as an inline error beneath the key input. Model selector stays locked. User can retry or skip.

**Step 2 — LinkedIn zip parse failure:** Import throws. Step shows an inline error with a retry option ("Try uploading again or skip to build your profile manually").

**Step 2 — CV parse partial:** PDF extraction returns incomplete data. Step shows a warning summary ("We extracted 3 roles — you can fill in the rest from your profile page") and allows continuing. Never a hard block.

**Step 3 — save failure:** Toast error, form stays open, user can retry or skip.

**Network loss mid-wizard:** Writes already made (key, profile import, search context) are durable. On re-entry, wizard restarts at step 1 but existing data surfaces immediately via initial state passed from the server component.

---

## Out of scope

The following are related but not part of this spec:

- **Activation tracking / funnel analytics** (#273 mentions this) — instrumentation of onboarding funnel steps, drop-off rates, and activation milestone (first job-fit analysis). Deferred to a follow-up.
- **Job-fit score tracking against outcomes** (#21) — post-activation feature.
- **Career archetype analysis** (#123) — long-term profile enrichment surface.
- **Progressive profile enrichment loop** — post-job-analysis profile suggestions. Mentioned in #273 but requires the activation milestone to be in place first.
