# Extraction Engine Upgrade + Batch Job Capture

**Date:** 2026-06-12  
**Issue:** #199 Batch Add Jobs  
**Branch:** to be cut from `origin/main`

---

## Problem

The current job extraction pipeline short-circuits at the first partial result. If JSON-LD finds only a title, it returns that incomplete record without cascading to the LLM tier to fill in the description and company. Users see half-populated forms and have to complete them manually without any indication of why fields are empty.

Additionally, the HTML-to-text conversion for LLM extraction uses a naive regex stripper, producing noisy tag soup rather than clean article prose. Many modern job boards are SPAs whose raw HTML is nearly empty — the installed `puppeteer-core` + `@sparticuz/chromium-min` deps have never been wired up.

There is no way to add multiple jobs at once.

---

## Goals

1. Cascade and merge across all extraction tiers — later tiers fill gaps left by earlier tiers rather than being skipped
2. Replace the naive HTML stripper with `@mozilla/readability` for clean LLM input
3. Wire up Puppeteer for SPA pages that return empty raw HTML
4. Add a batch capture flow with real-time per-URL progress
5. Keep `extractJobFromUrl(url)` as the single entry point — all callers unchanged

---

## Architecture

### Files changed

| File | Status |
|------|--------|
| `src/modules/jobs/extract-fetch.ts` | New — page fetching (raw → SPA detect → Puppeteer) |
| `src/modules/jobs/extract-llm.ts` | Modify — Readability replaces `stripHtmlToText` |
| `src/modules/jobs/extract.ts` | Modify — completeness scoring + cascade-merge |
| `src/modules/jobs/batch-capture.ts` | New — URL parsing + batch orchestration |
| `src/app/api/jobs/batch-capture/route.ts` | New — SSE streaming endpoint |
| `src/app/dashboard/job-applications/_components/batch-capture-dialog.tsx` | New — 3-step dialog UI |
| `src/app/dashboard/job-applications/_components/job-list.tsx` | Modify — add "Batch Add" button |

### New dependencies

- `@mozilla/readability` — article content extraction (Firefox Reader Mode engine)
- `linkedom` — lightweight DOM required by Readability on the server

No new dep for concurrency — a small inline semaphore covers the batch case.

---

## Section 1 — `extract-fetch.ts`

Owns all page fetching. The SSRF guard (`isSafeUrl`, `isPrivateIp`, `isSafeHostname`) moves here from `extract.ts` since this is now the fetch boundary.

```ts
type FetchedPage = {
  html: string
  via: 'raw' | 'puppeteer'
}

async function fetchPageContent(url: string): Promise<FetchedPage>
```

**Flow:**
1. Raw fetch with Googlebot UA + 12s timeout (existing behaviour)
2. Re-check final URL after redirects (existing SSRF redirect-hop guard)
3. **SPA detection**: strip `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`, `<aside>` from response HTML — if < 500 chars of text remain, treat as SPA shell and fall through
4. **Puppeteer fallback**: launch `@sparticuz/chromium-min`, navigate, wait `networkidle2`, return rendered HTML
5. If Puppeteer throws, return raw HTML so LLM can still attempt extraction

---

## Section 2 — `extract-llm.ts` — Readability upgrade

`stripHtmlToText` is replaced by `extractReadableContent(html: string, url: string): string`:

1. Parse HTML into a DOM with `linkedom`'s `parseHTML`
2. Run `new Readability(document).parse()` — same engine as Firefox Reader Mode
3. If parse succeeds, use `result.textContent` (clean prose, no nav/sidebar/footer)
4. If parse returns null (non-article page shape), fall back to current regex stripper
5. Truncate to 12,000 chars (unchanged)

`extractWithLLM` signature is unchanged — only the input text quality improves.

---

## Section 3 — Cascade and merge in `extract.ts`

### Completeness scoring

```ts
function scoreCompleteness(data: ExtractedJob): number {
  let score = 0
  if (data.title)          score += 0.25
  if (data.company)        score += 0.25
  if (data.jobDescription) score += 0.40
  if (data.location || data.salaryBand || data.datePublished || data.jobNumber) score += 0.10
  return score
}
```

Threshold: **0.65** — requires at minimum title + company + description (0.90) or title + company (0.50, not enough) to pass. A result with only a title (0.25) or title + company (0.50) continues cascading.

### Merge function

```ts
function mergeExtractedJob(base: ExtractedJob, overlay: ExtractedJob): ExtractedJob
```

Base values are never overwritten. `overlay` only fills fields that are `undefined` in `base`. Priority order: ATS data > JSON-LD > meta tags > LLM.

### New cascade flow

```
1. Tier 1 ATS (URL pattern match)
   → if score ≥ 0.65, return early  (fast path — complete ATS result, same as today)
   → else: keep as `accumulated`, continue

2. fetchPageContent(url)            (raw → SPA detect → Puppeteer)

3. Tier 2a: Embedded Greenhouse detect (HTML scan)
   → if found and ok, merge into accumulated

4. Tier 2b: JSON-LD parse
   → merge into accumulated (gaps only)

5. Tier 2c: Meta tags
   → merge into accumulated (gaps only)
   → if score ≥ 0.65, return

6. Tier 3: LLM extraction (Readability text)
   → merge into accumulated (gaps only)
   → return merged result
```

`fetchPageContent` is only called when we need HTML — if Tier 1 returns a complete result it short-circuits before the fetch.

---

## Section 4 — Batch capture

### URL parsing — `batch-capture.ts`

```ts
function parseUrlsFromText(text: string): string[]
```

1. Split on newlines and commas
2. Extract anything matching `https?://[^\s,\n"'<>]+`
3. Strip tracking params: `utm_*`, `fbclid`, `gclid`, `ref`, `mc_cid`, `hsCtaTracking`
4. Preserve ATS-specific params: `gh_jid`, `lever-origin`
5. Deduplicate by cleaned URL
6. Cap at 50 URLs

### SSE route — `POST /api/jobs/batch-capture`

Request body:
```json
{ "urls": ["https://...", "https://..."] }
```

Response: `text/event-stream`. Events emitted per URL:

```
data: {"index":0,"url":"...","status":"processing"}
data: {"index":0,"url":"...","status":"success","job":{"id":"...","title":"...","company":"..."},"created":true}
data: {"index":1,"url":"...","status":"failed","error":"Could not extract title and company"}
data: {"type":"done","added":8,"existing":3,"failed":2}
```

Concurrency: 3 simultaneous extractions via an inline semaphore. Prevents hammering target sites and keeps Vercel function memory stable for large batches.

Authentication: session cookie (same as other dashboard routes). `requireProfile()` called at route entry — 401 if not signed in.

### Batch dialog — `batch-capture-dialog.tsx`

Three-step state machine: `idle → processing → done`

**Step 1 — Input**
- Textarea: "Paste job URLs, one per line or comma-separated"
- Live counter: "12 URLs detected" updates as user types
- Submit disabled at 0 URLs; warning shown at 50 (hard cap)

**Step 2 — Processing**
- Non-dismissible while in flight (warn if user attempts)
- Progress bar: "8 / 20 processed"
- Per-URL rows update in real-time via SSE:
  - Pending → gray dot
  - Processing → spinner
  - Success → green check + extracted title/company
  - Failed → red X + short error message

**Step 3 — Done**
- Summary: "15 added · 3 already existed · 2 failed"
- Failed URLs in a copyable list with their error messages
- "Done" closes dialog; job list revalidates via `router.refresh()`

### Trigger

"Batch Add" button added to `ToolBar` in `job-list.tsx`, immediately left of "Add Job". Uses a `ListPlus` icon. Wired via `onBatchOpen` callback — same pattern as the existing `onCreateOpen`.

---

## Error handling

- **SSRF guard violations**: rejected before fetch, same as single capture
- **Individual URL failures**: written to the `failed` bucket, do not abort the batch
- **Puppeteer crash**: falls back to raw HTML; extraction continues
- **LLM not configured**: LLM tier is skipped; earlier tiers still run and may produce a partial result. No hard failure.
- **Batch route auth failure**: 401 immediately before any processing begins

---

## What is not in scope

- Retry logic for individual failed URLs (manual re-entry via the failed bucket copy)
- New ATS patterns (Rippling, iCIMS, SmartRecruiters, etc.) — separate issue
- JS rendering for the single-capture path on mobile (Puppeteer is server-only)
- Batch progress persistence across page reload
