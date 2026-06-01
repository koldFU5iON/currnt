# Job Extraction Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor job URL extraction into a three-tier pipeline (ATS routing → HTML parse → LLM fallback) with new Lever, Ashby, Workday, and Stripe-specific extractors, plus salary field wiring in the create form.

**Architecture:** Split the current monolithic `extract.ts` into `extract-utils.ts` (shared types + utilities), `extract-ats.ts` (all ATS extractors), `extract-llm.ts` (LLM fallback), and a slimmed-down `extract.ts` (orchestrator + HTML parsers). The orchestrator runs tiers in order, stopping at first success; 403s return a clear error immediately; the LLM fallback uses the user's existing LLM key via `completeStructured`.

**Tech Stack:** TypeScript strict, Next.js 16 App Router `'use server'`, Zod, Vitest, TurndownService (HTML→markdown), existing `completeStructured` LLM layer.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/modules/jobs/extract-utils.ts` | Create | Shared types (`ExtractedJob`, `ExtractionResult`), TurndownService instance, `decode`, `decodeEntities`, `formatSalaryBand` |
| `src/modules/jobs/extract-ats.ts` | Create | All ATS URL matchers + extractors: LinkedIn, Greenhouse, site overrides (Stripe), Lever, Ashby, Workday |
| `src/modules/jobs/extract-llm.ts` | Create | `stripHtmlToText`, `ExtractedJobLLMSchema`, `extractWithLLM` |
| `src/modules/jobs/extract.ts` | Modify | Slim orchestrator: imports from new files, keeps `fromJsonLd` + `fromMetaTags`, re-exports `ExtractedJob` |
| `src/modules/jobs/extract-utils.test.ts` | Create | Tests for `decodeEntities`, `formatSalaryBand` |
| `src/modules/jobs/extract-ats.test.ts` | Create | Tests for all URL matchers |
| `src/modules/jobs/extract-llm.test.ts` | Create | Tests for `stripHtmlToText`, `ExtractedJobLLMSchema` |
| `src/app/dashboard/job-applications/create/_components/create-job-form.tsx` | Modify | Wire `salaryBand` into form default values, `handleExtract`, and UI |

---

## Task 1: Create `extract-utils.ts` — shared types and utilities

**Files:**
- Create: `src/modules/jobs/extract-utils.ts`
- Create: `src/modules/jobs/extract-utils.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/modules/jobs/extract-utils.test.ts
import { describe, it, expect } from 'vitest'
import { decodeEntities, formatSalaryBand } from './extract-utils'

describe('decodeEntities', () => {
  it('decodes named entities', () => {
    expect(decodeEntities('&lt;p&gt;Hello &amp; world&lt;/p&gt;')).toBe('<p>Hello & world</p>')
  })
  it('decodes numeric decimal entities', () => {
    expect(decodeEntities('&#169;')).toBe('©')
  })
  it('decodes numeric hex entities', () => {
    expect(decodeEntities('&#x00A9;')).toBe('©')
  })
  it('decodes &amp; last to avoid double-decoding', () => {
    expect(decodeEntities('&amp;lt;')).toBe('&lt;')
  })
})

describe('formatSalaryBand', () => {
  it('formats a min/max range', () => {
    expect(formatSalaryBand({ currency: 'USD', value: { minValue: 120000, maxValue: 160000 } })).toBe('$120k–$160k')
  })
  it('formats a flat value', () => {
    expect(formatSalaryBand({ currency: 'USD', value: { value: 100000 } })).toBe('$100k')
  })
  it('uses GBP symbol', () => {
    expect(formatSalaryBand({ currency: 'GBP', value: { minValue: 80000, maxValue: 100000 } })).toBe('£80k–£100k')
  })
  it('returns undefined for non-object input', () => {
    expect(formatSalaryBand(null)).toBeUndefined()
    expect(formatSalaryBand('$100k')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- extract-utils
```

Expected: FAIL with "Cannot find module './extract-utils'"

- [ ] **Step 3: Create `extract-utils.ts`**

```ts
// src/modules/jobs/extract-utils.ts
import TurndownService from 'turndown'

export type ExtractedJob = {
  title?: string
  company?: string
  location?: string
  jobDescription?: string
  jobNumber?: string
  datePublished?: Date
  salaryBand?: string
}

export type ExtractionResult =
  | { ok: true; data: ExtractedJob }
  | { ok: false; error: string }

export const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' })
td.remove(['script', 'style', 'noscript'])

export function decode(s: string | undefined): string | undefined {
  return s ? decodeEntities(s) : s
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

export function formatSalaryBand(baseSalary: unknown): string | undefined {
  if (!baseSalary || typeof baseSalary !== 'object') return undefined
  const sal = baseSalary as Record<string, unknown>
  const curr = typeof sal.currency === 'string' ? sal.currency : 'USD'
  const sym = ({ USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$' } as Record<string, string>)[curr] ?? (curr + ' ')
  const abbrev = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
  const qv = sal.value && typeof sal.value === 'object' ? sal.value as Record<string, unknown> : null
  if (qv) {
    const min = typeof qv.minValue === 'number' ? qv.minValue : null
    const max = typeof qv.maxValue === 'number' ? qv.maxValue : null
    const flat = typeof qv.value === 'number' ? qv.value : null
    if (min !== null && max !== null) return `${sym}${abbrev(min)}–${abbrev(max)}`
    if (flat !== null) return `${sym}${abbrev(flat)}`
  }
  if (typeof sal.value === 'number') return `${sym}${abbrev(sal.value)}`
  return undefined
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- extract-utils
```

Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/jobs/extract-utils.ts src/modules/jobs/extract-utils.test.ts
git commit -m "feat(jobs): extract shared types and utilities into extract-utils.ts"
```

---

## Task 2: Create `extract-ats.ts` — all ATS extractors

**Files:**
- Create: `src/modules/jobs/extract-ats.ts`
- Create: `src/modules/jobs/extract-ats.test.ts`

- [ ] **Step 1: Write failing URL matcher tests**

```ts
// src/modules/jobs/extract-ats.test.ts
import { describe, it, expect } from 'vitest'
import {
  linkedInJobId,
  greenhouseFromUrl,
  matchSiteOverride,
  leverFromUrl,
  ashbyFromUrl,
  workdayFromUrl,
} from './extract-ats'

describe('linkedInJobId', () => {
  it('extracts job ID from /jobs/view/{id}', () => {
    expect(linkedInJobId('https://www.linkedin.com/jobs/view/4219034985')).toBe('4219034985')
  })
  it('extracts job ID from /jobs/view/{slug}-{id}', () => {
    expect(linkedInJobId('https://www.linkedin.com/jobs/view/senior-engineer-4219034985')).toBe('4219034985')
  })
  it('returns null for non-LinkedIn URLs', () => {
    expect(linkedInJobId('https://example.com/jobs/123')).toBeNull()
  })
})

describe('greenhouseFromUrl', () => {
  it('matches boards.greenhouse.io URLs', () => {
    expect(greenhouseFromUrl('https://boards.greenhouse.io/acme/jobs/12345')).toEqual({ board: 'acme', jobId: '12345' })
  })
  it('matches job-boards.greenhouse.io URLs', () => {
    expect(greenhouseFromUrl('https://job-boards.greenhouse.io/acme/jobs/12345')).toEqual({ board: 'acme', jobId: '12345' })
  })
  it('returns null for non-Greenhouse URLs', () => {
    expect(greenhouseFromUrl('https://stripe.com/jobs/listing/engineer/7790430')).toBeNull()
  })
})

describe('matchSiteOverride', () => {
  it('matches Stripe job URLs and returns Greenhouse board + jobId', () => {
    expect(matchSiteOverride('https://stripe.com/jobs/listing/sales-strategy/7790430')).toEqual({
      board: 'stripe',
      jobId: '7790430',
    })
  })
  it('returns null for non-override URLs', () => {
    expect(matchSiteOverride('https://lever.co/acme/jobs/abc')).toBeNull()
  })
})

describe('leverFromUrl', () => {
  it('matches jobs.lever.co URLs', () => {
    expect(leverFromUrl('https://jobs.lever.co/acme/550e8400-e29b-41d4-a716-446655440000')).toEqual({
      company: 'acme',
      jobId: '550e8400-e29b-41d4-a716-446655440000',
    })
  })
  it('returns null for non-Lever URLs', () => {
    expect(leverFromUrl('https://jobs.ashbyhq.com/acme/some-job')).toBeNull()
  })
})

describe('ashbyFromUrl', () => {
  it('matches jobs.ashbyhq.com URLs', () => {
    expect(ashbyFromUrl('https://jobs.ashbyhq.com/acme/senior-engineer')).toEqual({
      company: 'acme',
      jobSlug: 'senior-engineer',
    })
  })
  it('matches URL with UUID slug', () => {
    expect(ashbyFromUrl('https://jobs.ashbyhq.com/acme/550e8400-e29b-41d4-a716-446655440000')).toEqual({
      company: 'acme',
      jobSlug: '550e8400-e29b-41d4-a716-446655440000',
    })
  })
  it('returns null for non-Ashby URLs', () => {
    expect(ashbyFromUrl('https://jobs.lever.co/acme/abc')).toBeNull()
  })
})

describe('workdayFromUrl', () => {
  it('matches standard Workday URLs', () => {
    const result = workdayFromUrl(
      'https://amazon.wd5.myworkdayjobs.com/en-US/External_Marketplace_Career_Site/job/Seattle-WA/Software-Engineer_2287571',
    )
    expect(result).toEqual({
      subdomain: 'amazon.wd5',
      tenant: 'amazon',
      group: 'External_Marketplace_Career_Site',
      jobId: 'Seattle-WA',
    })
  })
  it('returns null for non-Workday URLs', () => {
    expect(workdayFromUrl('https://stripe.com/jobs/listing/engineer/123')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- extract-ats
```

Expected: FAIL with "Cannot find module './extract-ats'"

- [ ] **Step 3: Create `extract-ats.ts`**

```ts
// src/modules/jobs/extract-ats.ts
import { td, decode, decodeEntities, type ExtractedJob, type ExtractionResult } from './extract-utils'

// ── Site-specific Greenhouse overrides ──────────────────────────────────────
// Corporate SPAs that use Greenhouse but render client-side — we can't detect
// their embed script from SSR HTML, so we match the URL pattern directly.

interface SiteOverride {
  pattern: RegExp
  board: string
  jobId: (match: RegExpMatchArray) => string
}

const GREENHOUSE_SITE_OVERRIDES: SiteOverride[] = [
  {
    pattern: /stripe\.com\/jobs\/listing\/[^/]+\/(\d+)/i,
    board: 'stripe',
    jobId: m => m[1],
  },
]

export function matchSiteOverride(url: string): { board: string; jobId: string } | null {
  for (const override of GREENHOUSE_SITE_OVERRIDES) {
    const m = url.match(override.pattern)
    if (m) return { board: override.board, jobId: override.jobId(m) }
  }
  return null
}

// ── LinkedIn (/jobs/view/{id}) ───────────────────────────────────────────────

export function linkedInJobId(url: string): string | null {
  const m = url.match(/linkedin\.com\/jobs\/view\/(?:[^/]+-)?(\d+)/i)
  return m?.[1] ?? null
}

export async function extractLinkedIn(jobId: string): Promise<ExtractionResult> {
  const apiUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`
  let html: string
  try {
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      return { ok: false, error: `LinkedIn returned ${res.status} — the job may no longer be available.` }
    }
    html = await res.text()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: `Could not reach LinkedIn: ${msg}` }
  }

  const attr = (pattern: RegExp) => decode(html.match(pattern)?.[1]?.trim())
  const title = attr(/class="[^"]*topcard__title[^"]*"[^>]*>([^<]+)</)
    ?? attr(/<h2[^>]*class="[^"]*top-card-layout__title[^"]*"[^>]*>([^<]+)</)
  const company = attr(/class="[^"]*topcard__org-name-link[^"]*"[^>]*>\s*([^<\n]+)\s*<\/a>/i)
  const location = attr(/class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>\s*([^<\n]+)\s*<\//)
  const descHtml = attr(/class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]+?)<\/div>/)
  const jobDescription = descHtml ? td.turndown(descHtml) : undefined

  if (!title && !company && !jobDescription) {
    return { ok: false, error: 'Could not extract details from this LinkedIn job. Try copying the details manually.' }
  }
  return { ok: true, data: { title, company, location, jobDescription, jobNumber: jobId } }
}

// ── Greenhouse (public Boards API) ───────────────────────────────────────────

export function greenhouseFromUrl(url: string): { board: string; jobId: string } | null {
  const m = url.match(/(?:^|\/\/)(?:boards|job-boards)\.greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i)
  return m ? { board: m[1], jobId: m[2] } : null
}

export function greenhouseFromHtml(url: string, html: string): { board: string; jobId: string } | null {
  const board = html.match(/(?:boards|job-boards)\.greenhouse\.io\/embed\/job_board\/js\?for=([a-z0-9_-]+)/i)?.[1]
  if (!board) return null
  const jobId =
    url.match(/[?&]gh_jid=(\d+)/i)?.[1] ??
    html.match(/gh_jid=(\d+)/i)?.[1] ??
    url.match(/\/(?:jobs?|positions?)\/(\d+)/i)?.[1]
  return jobId ? { board, jobId } : null
}

export async function extractGreenhouse(board: string, jobId: string): Promise<ExtractionResult> {
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}?content=true`
  let payload: Record<string, unknown>
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      return { ok: false, error: `Greenhouse returned ${res.status} — the job may no longer be available.` }
    }
    payload = (await res.json()) as Record<string, unknown>
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: `Could not reach Greenhouse: ${msg}` }
  }

  const contentRaw = typeof payload.content === 'string' ? payload.content : ''
  const jobDescription = contentRaw ? td.turndown(decodeEntities(contentRaw)) : undefined
  const rawDate = typeof payload.first_published === 'string' ? payload.first_published : undefined
  const parsed = rawDate ? new Date(rawDate) : undefined
  const datePublished = parsed && !isNaN(parsed.getTime()) ? parsed : undefined
  const location = (payload.location as Record<string, unknown> | undefined)?.name
  const idValue = payload.id != null ? String(payload.id) : jobId

  return {
    ok: true,
    data: {
      title: decode(typeof payload.title === 'string' ? payload.title.trim() : undefined),
      company: decode(typeof payload.company_name === 'string' ? payload.company_name.trim() : undefined),
      location: decode(typeof location === 'string' ? location : undefined),
      jobDescription,
      jobNumber: idValue,
      datePublished,
    },
  }
}

// ── Lever (public Postings API) ──────────────────────────────────────────────

export function leverFromUrl(url: string): { company: string; jobId: string } | null {
  const m = url.match(/jobs\.lever\.co\/([^/?#]+)\/([a-f0-9-]{36})/i)
  return m ? { company: m[1], jobId: m[2] } : null
}

export async function extractLever(company: string, jobId: string): Promise<ExtractionResult> {
  const apiUrl = `https://api.lever.co/v0/postings/${company}/${jobId}?mode=json`
  let payload: Record<string, unknown>
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      return { ok: false, error: `Lever returned ${res.status} — the job may no longer be available.` }
    }
    payload = (await res.json()) as Record<string, unknown>
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: `Could not reach Lever: ${msg}` }
  }

  const categories = payload.categories as Record<string, unknown> | undefined
  const parts: string[] = []
  if (typeof payload.description === 'string' && payload.description) {
    parts.push(payload.description)
  }
  if (Array.isArray(payload.lists)) {
    for (const list of payload.lists as Array<Record<string, unknown>>) {
      if (typeof list.text === 'string' && typeof list.content === 'string') {
        parts.push(`<h3>${list.text}</h3>${list.content}`)
      }
    }
  }
  const jobDescription = parts.length > 0 ? td.turndown(parts.join('\n')) : undefined
  const salaryBand = formatLeverSalary(payload.salaryRange)

  return {
    ok: true,
    data: {
      title: decode(typeof payload.text === 'string' ? payload.text.trim() : undefined),
      location: decode(typeof categories?.location === 'string' ? categories.location : undefined),
      jobDescription,
      jobNumber: jobId,
      salaryBand,
    },
  }
}

function formatLeverSalary(salaryRange: unknown): string | undefined {
  if (!salaryRange || typeof salaryRange !== 'object') return undefined
  const s = salaryRange as Record<string, unknown>
  const curr = typeof s.currency === 'string' ? s.currency : 'USD'
  const sym = ({ USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$' } as Record<string, string>)[curr] ?? (curr + ' ')
  const abbrev = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
  const min = typeof s.min === 'number' ? s.min : null
  const max = typeof s.max === 'number' ? s.max : null
  if (min !== null && max !== null) return `${sym}${abbrev(min)}–${abbrev(max)}`
  if (min !== null) return `${sym}${abbrev(min)}+`
  return undefined
}

// ── Ashby (public Posting API) ───────────────────────────────────────────────

export function ashbyFromUrl(url: string): { company: string; jobSlug: string } | null {
  const m = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)\/([^/?#]+)/i)
  return m ? { company: m[1], jobSlug: m[2] } : null
}

export async function extractAshby(company: string, jobSlug: string): Promise<ExtractionResult> {
  const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${company}/posting/${jobSlug}`
  let payload: Record<string, unknown>
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      return { ok: false, error: `Ashby returned ${res.status} — the job may no longer be available.` }
    }
    payload = (await res.json()) as Record<string, unknown>
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: `Could not reach Ashby: ${msg}` }
  }

  const jobDescription = typeof payload.descriptionHtml === 'string' && payload.descriptionHtml
    ? td.turndown(payload.descriptionHtml)
    : undefined
  const location = payload.isRemote === true
    ? 'Remote'
    : typeof payload.locationName === 'string' ? payload.locationName : undefined
  const rawDate = typeof payload.publishedDate === 'string' ? payload.publishedDate : undefined
  const parsed = rawDate ? new Date(rawDate) : undefined
  const datePublished = parsed && !isNaN(parsed.getTime()) ? parsed : undefined
  const comp = payload.compensation as Record<string, unknown> | undefined
  const salaryBand = typeof comp?.compensationTierSummary === 'string'
    ? comp.compensationTierSummary
    : undefined

  return {
    ok: true,
    data: {
      title: decode(typeof payload.title === 'string' ? payload.title.trim() : undefined),
      location: decode(location),
      jobDescription,
      jobNumber: typeof payload.id === 'string' ? payload.id : undefined,
      datePublished,
      salaryBand,
    },
  }
}

// ── Workday (internal API, best-effort) ──────────────────────────────────────
// Workday URLs: {tenant}.wd{N}.myworkdayjobs.com/en-US/{group}/job/{jobId}/{slug}
// The API is undocumented — returns null on any failure to fall through to tier 2.

export function workdayFromUrl(url: string): { subdomain: string; tenant: string; group: string; jobId: string } | null {
  const hostnameMatch = url.match(/^https?:\/\/(([a-z0-9-]+)\.wd\d+)\.myworkdayjobs\.com/i)
  if (!hostnameMatch) return null
  const subdomain = hostnameMatch[1]
  const tenant = hostnameMatch[2]
  const pathMatch = url.match(/\/([A-Za-z0-9_-]+)\/job\/([A-Za-z0-9_-]+)/i)
  if (!pathMatch) return null
  return { subdomain, tenant, group: pathMatch[1], jobId: pathMatch[2] }
}

export async function extractWorkday(
  subdomain: string,
  tenant: string,
  group: string,
  jobId: string,
): Promise<ExtractionResult | null> {
  const apiUrl = `https://${subdomain}.myworkdayjobs.com/wday/cxs/${tenant}/${group}/jobs/${jobId}`
  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const payload = (await res.json()) as Record<string, unknown>
    const postings = Array.isArray(payload.jobPostings) ? payload.jobPostings : []
    const job = postings[0] as Record<string, unknown> | undefined
    if (!job) return null

    const jobDescription = typeof job.jobDescription === 'string' && job.jobDescription
      ? td.turndown(job.jobDescription)
      : undefined

    return {
      ok: true,
      data: {
        title: decode(typeof job.title === 'string' ? job.title.trim() : undefined),
        location: decode(typeof job.locationsText === 'string' ? job.locationsText.trim() : undefined),
        jobDescription,
        jobNumber: typeof job.externalPath === 'string' ? job.externalPath : undefined,
      },
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- extract-ats
```

Expected: all URL matcher tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/jobs/extract-ats.ts src/modules/jobs/extract-ats.test.ts
git commit -m "feat(jobs): add extract-ats.ts with Lever, Ashby, Workday, and Stripe override extractors"
```

---

## Task 3: Create `extract-llm.ts` — LLM fallback

**Files:**
- Create: `src/modules/jobs/extract-llm.ts`
- Create: `src/modules/jobs/extract-llm.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/modules/jobs/extract-llm.test.ts
import { describe, it, expect } from 'vitest'
import { stripHtmlToText, ExtractedJobLLMSchema } from './extract-llm'

describe('stripHtmlToText', () => {
  it('removes script and style tags and their content', () => {
    const html = '<p>Job title</p><script>alert("xss")</script><style>.btn{}</style>'
    const result = stripHtmlToText(html)
    expect(result).toContain('Job title')
    expect(result).not.toContain('alert')
    expect(result).not.toContain('.btn')
  })

  it('removes nav, header, footer, aside elements', () => {
    const html = '<nav>Menu</nav><main><p>Description</p></main><footer>© 2024</footer>'
    const result = stripHtmlToText(html)
    expect(result).toContain('Description')
    expect(result).not.toContain('Menu')
    expect(result).not.toContain('© 2024')
  })

  it('strips remaining HTML tags', () => {
    const html = '<h1 class="title">Senior Engineer</h1><p>Build things.</p>'
    expect(stripHtmlToText(html)).toContain('Senior Engineer')
    expect(stripHtmlToText(html)).not.toContain('<h1')
  })

  it('truncates to 12000 characters', () => {
    const html = '<p>' + 'a'.repeat(20_000) + '</p>'
    expect(stripHtmlToText(html).length).toBeLessThanOrEqual(12_000)
  })

  it('decodes common HTML entities', () => {
    const html = '<p>Salary: $120k &amp; benefits</p>'
    expect(stripHtmlToText(html)).toContain('$120k & benefits')
  })
})

describe('ExtractedJobLLMSchema', () => {
  it('accepts a fully populated object', () => {
    const result = ExtractedJobLLMSchema.safeParse({
      title: 'Senior Engineer',
      company: 'Acme',
      location: 'Remote',
      jobDescription: 'Build things.',
      jobNumber: 'REQ-123',
      salaryBand: '$120k–$160k',
      datePublished: '2024-01-15',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an empty object (all fields optional)', () => {
    expect(ExtractedJobLLMSchema.safeParse({}).success).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- extract-llm
```

Expected: FAIL with "Cannot find module './extract-llm'"

- [ ] **Step 3: Create `extract-llm.ts`**

```ts
// src/modules/jobs/extract-llm.ts
import * as z from 'zod'
import { requireProfile } from '@/lib/session'
import { completeStructured } from '@/modules/llm/client'
import { LLMError } from '@/modules/llm/errors'
import type { ExtractedJob, ExtractionResult } from './extract-utils'

export const ExtractedJobLLMSchema = z.object({
  title:          z.string().optional().describe('Job title exactly as written'),
  company:        z.string().optional().describe('Hiring company name'),
  location:       z.string().optional().describe('Office location or "Remote"'),
  jobDescription: z.string().optional().describe('Full job description text, preserve all detail'),
  jobNumber:      z.string().optional().describe('Job ID or requisition number visible on the page'),
  salaryBand:     z.string().optional().describe('Salary range as a short string, e.g. "$120k–$160k"'),
  datePublished:  z.string().optional().describe('ISO date string if a posting date is visible on the page'),
})

const NOISE_TAGS_RE = /<(script|style|noscript|nav|header|footer|aside|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi
const ALL_TAGS_RE = /<[^>]+>/g
const MAX_CHARS = 12_000

export function stripHtmlToText(html: string): string {
  return html
    .replace(NOISE_TAGS_RE, '')
    .replace(ALL_TAGS_RE, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHARS)
}

export async function extractWithLLM(html: string): Promise<ExtractionResult> {
  let profileId: string
  try {
    const { profile } = await requireProfile()
    profileId = profile.id
  } catch {
    return {
      ok: false,
      error: 'No job details found. Add an LLM key in Settings to enable AI extraction, or paste manually.',
    }
  }

  const text = stripHtmlToText(html)
  const prompt = `Extract the job posting details from the following webpage text. Return only what is explicitly present — do not infer or invent values.\n\n${text}`

  try {
    const result = await completeStructured(profileId, prompt, ExtractedJobLLMSchema, {
      maxOutputTokens: 400,
      temperature: 0,
    })
    const raw = result.object
    const parsedDate = raw.datePublished ? new Date(raw.datePublished) : undefined
    const data: ExtractedJob = {
      title: raw.title,
      company: raw.company,
      location: raw.location,
      jobDescription: raw.jobDescription,
      jobNumber: raw.jobNumber,
      salaryBand: raw.salaryBand,
      datePublished: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : undefined,
    }
    if (!data.title && !data.company && !data.jobDescription) {
      return { ok: false, error: 'Could not extract details — try pasting manually.' }
    }
    return { ok: true, data }
  } catch (err) {
    if (err instanceof LLMError && err.kind === 'not_configured') {
      return {
        ok: false,
        error: 'No job details found. Add an LLM key in Settings to enable AI extraction, or paste manually.',
      }
    }
    return { ok: false, error: 'Could not extract details — try pasting manually.' }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- extract-llm
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/jobs/extract-llm.ts src/modules/jobs/extract-llm.test.ts
git commit -m "feat(jobs): add extract-llm.ts with LLM fallback and HTML stripping"
```

---

## Task 4: Rewrite `extract.ts` as slim orchestrator

**Files:**
- Modify: `src/modules/jobs/extract.ts`

This task replaces the entire file. The new version imports from the three new files and keeps `fromJsonLd` + `fromMetaTags` (tier 2 HTML parsers). `ExtractedJob` is re-exported for backward compatibility — the create form imports it from this path.

- [ ] **Step 1: Run existing tests to establish baseline**

```bash
npm test
```

Expected: all existing tests PASS before any changes.

- [ ] **Step 2: Replace `extract.ts` with the orchestrator**

```ts
// src/modules/jobs/extract.ts
'use server'

import type { ExtractionResult, ExtractedJob } from './extract-utils'
export type { ExtractedJob }
import { decode, td, formatSalaryBand } from './extract-utils'
import {
  linkedInJobId, extractLinkedIn,
  greenhouseFromUrl, greenhouseFromHtml, extractGreenhouse,
  matchSiteOverride,
  leverFromUrl, extractLever,
  ashbyFromUrl, extractAshby,
  workdayFromUrl, extractWorkday,
} from './extract-ats'
import { extractWithLLM } from './extract-llm'

export async function extractJobFromUrl(url: string): Promise<ExtractionResult> {
  // ── Tier 1: ATS routing (no HTML fetch) ──────────────────────────────────
  const linkedInId = linkedInJobId(url)
  if (linkedInId) return extractLinkedIn(linkedInId)

  const siteOverride = matchSiteOverride(url)
  if (siteOverride) return extractGreenhouse(siteOverride.board, siteOverride.jobId)

  const directGh = greenhouseFromUrl(url)
  if (directGh) return extractGreenhouse(directGh.board, directGh.jobId)

  const lever = leverFromUrl(url)
  if (lever) return extractLever(lever.company, lever.jobId)

  const ashby = ashbyFromUrl(url)
  if (ashby) return extractAshby(ashby.company, ashby.jobSlug)

  const workday = workdayFromUrl(url)
  if (workday) {
    const result = await extractWorkday(workday.subdomain, workday.tenant, workday.group, workday.jobId)
    if (result) return result
    // null = API unavailable, fall through to HTML fetch
  }

  // ── Tier 2: HTML fetch + structural parse ─────────────────────────────────
  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      return {
        ok: false,
        error: `Could not reach that page — it may block automated access (${res.status}). Try pasting the details manually.`,
      }
    }
    html = await res.text()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: `Could not reach that URL: ${msg}` }
  }

  const embeddedGh = greenhouseFromHtml(url, html)
  if (embeddedGh) {
    const ghResult = await extractGreenhouse(embeddedGh.board, embeddedGh.jobId)
    if (ghResult.ok) return ghResult
  }

  const extracted = fromJsonLd(html) ?? fromMetaTags(html)
  if (extracted.title || extracted.company || extracted.jobDescription) {
    return { ok: true, data: extracted }
  }

  // ── Tier 3: LLM extraction ────────────────────────────────────────────────
  return extractWithLLM(html)
}

// ── JSON-LD JobPosting ────────────────────────────────────────────────────────

function fromJsonLd(html: string): ExtractedJob | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]

  for (const block of blocks) {
    try {
      const raw = JSON.parse(block[1])
      const candidates: unknown[] = Array.isArray(raw?.['@graph']) ? raw['@graph'] : [raw]
      const job = candidates.find(
        (c): c is Record<string, unknown> =>
          typeof c === 'object' && c !== null && (c as Record<string, unknown>)['@type'] === 'JobPosting',
      )
      if (!job) continue

      const addr = (job.jobLocation as Record<string, unknown> | undefined)?.address as Record<string, unknown> | undefined
      const city = addr?.addressLocality as string | undefined
      const country = addr?.addressCountry as string | undefined
      const isRemote = job.jobLocationType === 'TELECOMMUTE'
      const locationParts = isRemote
        ? ['Remote', city, country].filter(Boolean)
        : [city, country].filter(Boolean)

      const descHtml = (job.description as string | undefined) ?? ''
      const jobDescription = descHtml ? td.turndown(descHtml) : undefined

      const rawDate = job.datePosted as string | undefined
      const parsed = rawDate ? new Date(rawDate) : undefined
      const datePublished = parsed && !isNaN(parsed.getTime()) ? parsed : undefined

      const org = job.hiringOrganization as Record<string, unknown> | undefined
      const identifier = job.identifier as Record<string, unknown> | undefined

      return {
        title: decode((job.title as string | undefined)?.trim()),
        company: decode((org?.name as string | undefined)?.trim()),
        location: decode(locationParts.length > 0 ? (locationParts as string[]).join(', ') : undefined),
        jobDescription,
        jobNumber: identifier?.value != null ? String(identifier.value) : undefined,
        datePublished,
        salaryBand: formatSalaryBand(job.baseSalary),
      }
    } catch {
      // malformed block — try the next one
    }
  }
  return null
}

// ── OpenGraph / meta fallback ─────────────────────────────────────────────────

function fromMetaTags(html: string): ExtractedJob {
  const og = (prop: string) => {
    const a = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
    const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'))
    return decode((a?.[1] ?? b?.[1])?.trim())
  }

  const title =
    og('og:title') ??
    decode(html.match(/<h1[^>]*>([^<]{3,120})<\/h1>/i)?.[1]?.trim()) ??
    decode(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s*[\|\-–]\s*.+$/, '').trim())

  return {
    title: title ?? undefined,
    jobDescription: og('og:description') ?? undefined,
  }
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests PASS (existing + new)

- [ ] **Step 5: Commit**

```bash
git add src/modules/jobs/extract.ts
git commit -m "refactor(jobs): rewrite extract.ts as three-tier orchestrator (ATS routing → HTML parse → LLM fallback)"
```

---

## Task 5: Wire `salaryBand` into the create form

**Files:**
- Modify: `src/app/dashboard/job-applications/create/_components/create-job-form.tsx`

- [ ] **Step 1: Add `salaryBand` to form defaultValues**

Find the `useForm` call (line 33) and add `salaryBand: ''` to defaultValues:

```ts
const form = useForm<z.infer<typeof createJobSchema>>({
  resolver: zodResolver(createJobSchema),
  defaultValues: {
    title: '',
    company: '',
    url: '',
    location: '',
    jobNumber: '',
    jobDescription: '',
    salaryBand: '',
    datePublished: new Date(),
    applicationSource: 'cold',
  },
})
```

- [ ] **Step 2: Wire extraction result into the form**

In `handleExtract`, after the existing `form.setValue` calls (around line 66), add:

```ts
if (data.salaryBand) form.setValue('salaryBand', data.salaryBand)
```

The full updated block:

```ts
if (data.title) form.setValue('title', data.title, { shouldValidate: true })
if (data.company) form.setValue('company', data.company, { shouldValidate: true })
if (data.location) form.setValue('location', data.location)
if (data.jobDescription) form.setValue('jobDescription', data.jobDescription)
if (data.jobNumber) form.setValue('jobNumber', data.jobNumber)
if (data.datePublished) form.setValue('datePublished', data.datePublished)
if (data.salaryBand) form.setValue('salaryBand', data.salaryBand)
```

- [ ] **Step 3: Add salary field to the form UI**

Add a new 2-column row after the existing location/jobNumber row (around line 151):

```tsx
<div className="grid grid-cols-2 gap-4">
  <FormField name="salaryBand" label="Salary Band" placeholder="e.g. $120k–$160k" />
  <FormField name="applicationSource" label="Source" type="select" options={SOURCE_OPTIONS} />
</div>
```

Remove the existing standalone `applicationSource` row (the old `grid grid-cols-2` block for `datePublished` / `applicationSource`) and replace with:

```tsx
<div className="grid grid-cols-2 gap-4">
  <FormField name="datePublished" label="Date Published" type="date" />
  <FormField name="salaryBand" label="Salary Band" placeholder="e.g. $120k–$160k" />
</div>

<FormField
  name="applicationSource"
  label="Source"
  type="select"
  options={SOURCE_OPTIONS}
/>
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/job-applications/create/_components/create-job-form.tsx
git commit -m "feat(jobs): wire salaryBand through extraction and into create form UI"
```

---

## Final check

- [ ] **Run full test suite**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Manual smoke test**

1. Start dev server: `npm run dev`
2. Go to `/dashboard/job-applications/create`
3. Test Stripe URL: `https://stripe.com/jobs/listing/sales-strategy-operations-sales-business-partner/7790430` — should extract via Greenhouse override
4. Test a Lever URL: `https://jobs.lever.co/vercel/` (any live Lever posting) — should extract via Lever API
5. Test a known working URL (e.g. a Greenhouse direct URL) — should still work
6. Verify salary field appears in the form and populates when extracted
