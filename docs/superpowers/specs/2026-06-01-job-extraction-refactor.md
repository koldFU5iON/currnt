# Job Extraction Refactor — Flexible ATS Routing + LLM Fallback

**Issues:** #77 (Stripe extraction failure), #78 (Epic Games 403)
**Date:** 2026-06-01

---

## Overview

The current extraction pipeline fails on two common cases: JavaScript-rendered career pages (Stripe) and sites that actively block automated fetches (Epic Games). This refactor adds three new ATS-specific extractors, a site-specific Greenhouse override table, an LLM fallback for pages that return HTML but resist parsing, and wires the existing `salaryBand` field through to the create form UI.

---

## Architecture — Three-Tier Pipeline

`extractJobFromUrl(url)` runs tiers in order, stopping at the first success:

```
Tier 1 — ATS routing (URL pattern match, no HTML fetch)
  LinkedIn          → extractLinkedIn()          existing
  Greenhouse direct → extractGreenhouse()         existing
  Lever             → extractLever()              new
  Ashby             → extractAshby()              new
  Workday           → extractWorkday()            new (best-effort)
  Site overrides    → table lookup → ATS API      new (Stripe → Greenhouse)

Tier 2 — HTML fetch + structural parse            existing, unchanged
  Greenhouse embed detection → extractGreenhouse()
  JSON-LD JobPosting schema
  OpenGraph / meta tags

Tier 3 — LLM extraction                          new
  Strip + truncate HTML to plain text (~12k chars)
  completeStructured() with ExtractedJobLLMSchema
  Uses user's own LLM key (requireProfile() inline)

Hard failure
  403 / network error before any HTML → return { ok: false, error }
  LLM not configured + tier 3 reached → return { ok: false, error }
```

---

## File Structure

Current `extract.ts` is 299 lines. After additions it would exceed 600. Split into three focused files:

| File | Responsibility |
|------|----------------|
| `src/modules/jobs/extract.ts` | Orchestrator (`extractJobFromUrl`), tier 2 HTML parsers (JSON-LD, meta tags), decode utilities |
| `src/modules/jobs/extract-ats.ts` | All ATS URL matchers + extractor functions (LinkedIn, Greenhouse, Lever, Ashby, Workday, site overrides) |
| `src/modules/jobs/extract-llm.ts` | LLM fallback function only |

`extract.ts` remains the sole entry point and the only `'use server'` file. The two new files export plain async functions imported by the orchestrator.

---

## Tier 1 — New ATS Extractors

### Lever

**Detection:** `jobs.lever.co/{company}/{uuid}`

**API:** `GET https://api.lever.co/v0/postings/{company}/{id}?mode=json`

**Response mapping:**
- `text` → `title`
- `categories.location` → `location`
- `description` (HTML) + `lists[].content` (HTML) → combined, Turndown → `jobDescription`
- `id` → `jobNumber`
- `salaryRange.min` / `salaryRange.max` / `salaryRange.currency` → formatted `salaryBand` (e.g. `$120k–$160k`)

**Salary format:** same `formatSalaryBand` helper as JSON-LD extractor, adapted for Lever's shape.

### Ashby

**Detection:** `jobs.ashbyhq.com/{company}/{jobSlug}`

**API:** `GET https://api.ashbyhq.com/posting-api/job-board/{company}/posting/{jobSlug}`

**Response mapping:**
- `title` → `title`
- `locationName` (or `isRemote` → `"Remote"`) → `location`
- `descriptionHtml` (HTML) → Turndown → `jobDescription`
- `id` → `jobNumber`
- `publishedDate` → `datePublished`
- `compensation.compensationTierSummary` (string, when present) → `salaryBand`

### Workday

**Detection:** `*.wd{N}.myworkdayjobs.com/*` (hostname match)

**URL parsing:** extract `tenant` from hostname (`{tenant}.wd{N}.myworkdayjobs.com`); extract `requisitionGroup` and `jobId` from path (`/en-US/{requisitionGroup}/job/{jobId}/...`).

**API (best-effort, undocumented):**
`GET https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{requisitionGroup}/jobs/{jobId}`

**Response mapping (when API succeeds):**
- `title` → `title`
- `locationsText` → `location`
- `jobDescription` (HTML) → Turndown → `jobDescription`
- `externalPath` → `jobNumber`

**Fallback:** if the API returns non-200 or the response shape is unrecognised, return `null` from the matcher so the orchestrator falls through to tier 2 (HTML fetch).

Salary is not reliably present in Workday API responses — omit.

### Site-specific Greenhouse Overrides

A lookup table for corporate SPA sites that use Greenhouse but whose JS-rendered pages can't be detected from HTML:

```ts
const GREENHOUSE_SITE_OVERRIDES: Array<{
  pattern: RegExp
  board: string
  jobId: (match: RegExpMatchArray) => string
}> = [
  {
    // stripe.com/jobs/listing/{slug}/{numericId}
    pattern: /stripe\.com\/jobs\/listing\/[^/]+\/(\d+)/i,
    board: 'stripe',
    jobId: m => m[1],
  },
]
```

Checked before the generic HTML fetch. Additional entries added here as new sites are reported.

---

## Tier 3 — LLM Fallback (`extract-llm.ts`)

**Trigger condition:** tier 2 HTML fetch returned 2xx, but all three parsers (Greenhouse embed, JSON-LD, meta tags) yielded no title, company, or description.

**Not triggered for:** 403s, network errors, timeout.

**Process:**
1. Call `requireProfile()` to get `profileId` (user is always authenticated at this point)
2. Strip tags: remove `<script>`, `<style>`, `<noscript>`, `<nav>`, `<header>`, `<footer>`, `<aside>`, `<svg>` elements
3. Strip remaining HTML tags to plain text
4. Truncate to 12,000 characters
5. Call `completeStructured(profileId, text, ExtractedJobLLMSchema, { maxOutputTokens: 400, temperature: 0 })`
6. Map result to `ExtractedJob`

**If LLM is not configured:** return `{ ok: false, error: 'Could not extract details automatically — try pasting manually, or add an LLM key in Settings to enable AI extraction.' }`

**Schema (`ExtractedJobLLMSchema`):**
```ts
z.object({
  title:          z.string().optional().describe('Job title exactly as written'),
  company:        z.string().optional().describe('Hiring company name'),
  location:       z.string().optional().describe('Office location or "Remote"'),
  jobDescription: z.string().optional().describe('Full job description, preserve formatting'),
  jobNumber:      z.string().optional().describe('Job ID or requisition number from the page'),
  salaryBand:     z.string().optional().describe('Salary range as a short string, e.g. "$120k–$160k"'),
  datePublished:  z.string().optional().describe('ISO date string if a posting date is visible'),
})
```

Date is returned as a string and parsed to `Date` after extraction (same pattern as JSON-LD extractor).

---

## Salary Field — Form Wiring

`salaryBand` is already in `createJobSchema` and persisted via `createJobApplication`. Gaps to close:

**`create-job-form.tsx`:**
1. Add `salaryBand: ''` to `useForm` default values
2. Add `if (data.salaryBand) form.setValue('salaryBand', data.salaryBand)` in `handleExtract`
3. Add a `<FormField name="salaryBand" label="Salary Band" placeholder="e.g. $120k–$160k" />` to the form UI (alongside location / jobNumber row or its own row)

---

## Error Messages

| Scenario | Message |
|----------|---------|
| 403 / unreachable | `"Could not reach that page — it may block automated access. Try pasting the details manually."` |
| Fetch succeeded, nothing found, no LLM key | `"No job details found. Add an LLM key in Settings to enable AI extraction, or paste manually."` |
| Fetch succeeded, nothing found, LLM configured | LLM extraction runs silently; error only shown if LLM also fails |
| LLM extraction fails | `"Could not extract details — try pasting manually."` |
| ATS API returns non-200 (Workday, etc.) | Fall through to next tier; error only if all tiers exhausted |

---

## Out of Scope

- Headless browser / Playwright rendering
- Third-party scraping services (Jina, Firecrawl)
- iCIMS, Taleo, SAP SuccessFactors, SmartRecruiters (long tail — LLM fallback covers these)
- Browser extension or bookmarklet changes
