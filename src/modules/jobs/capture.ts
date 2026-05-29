// Job-capture orchestrator — wraps URL extraction + dedup + create into a
// single server-side function. Used by:
//   - the public POST /api/jobs/capture endpoint (bearer-token auth)
//   - any future browser-extension / agent / bookmarklet path that lands
//     on a stable internal API
//
// Takes profileId explicitly (no session lookup) so it can be called from
// API routes that authenticate via something other than the session cookie.

import { prisma } from '@/lib/db'
import { extractJobFromUrl } from './extract'
import {
  findPotentialDuplicatesForProfile,
  type DuplicateMatch,
} from './dedup-internal'

export type CaptureInput = {
  url: string
  notes?: string
  applicationSource?: 'cold' | 'referral' | 'recruiter_outreach'
  // What to do when an existing job matches:
  //   return_existing — return the matched job, don't create a new one (default)
  //   create_anyway   — proceed with creation even if a match is found
  dedupeStrategy?: 'return_existing' | 'create_anyway'
}

export type CaptureSuccess = {
  ok: true
  created: boolean  // true = new row written, false = returned existing match
  job: {
    id: string
    title: string
    company: string
  }
  duplicate: DuplicateMatch | null  // populated whenever a match was found, regardless of strategy
  extraction: {
    fieldsExtracted: string[]
  }
}

export type CaptureFailure = {
  ok: false
  status: number
  error: string
}

export type CaptureResult = CaptureSuccess | CaptureFailure

// Required fields for a "real enough" record. If extraction can't satisfy
// these and the caller didn't supply overrides, we reject — better than
// quietly creating a placeholder no agent will know to fix later.
const PLACEHOLDER_TITLE = '(untitled)'
const PLACEHOLDER_COMPANY = '(unknown)'

export async function captureJobFromUrl(
  profileId: string,
  input: CaptureInput,
): Promise<CaptureResult> {
  const url = input.url.trim()
  if (!url) return { ok: false, status: 400, error: 'url is required' }

  // Loose URL validation — extractJobFromUrl will fail fast on garbage anyway,
  // but rejecting obvious non-URLs at the boundary keeps error messages clean.
  try { new URL(url) } catch {
    return { ok: false, status: 400, error: 'url is not a valid URL' }
  }

  const extraction = await extractJobFromUrl(url)
  if (!extraction.ok) {
    return { ok: false, status: 422, error: `Could not extract job details: ${extraction.error}` }
  }
  const data = extraction.data

  const title = data.title?.trim() || PLACEHOLDER_TITLE
  const company = data.company?.trim() || PLACEHOLDER_COMPANY

  // Dedupe — match on jobNumber first (strong), then title+company (weak).
  const matches = await findPotentialDuplicatesForProfile(profileId, {
    jobNumber: data.jobNumber,
    title,
    company,
  })
  const duplicate = matches[0] ?? null
  const strategy = input.dedupeStrategy ?? 'return_existing'

  if (duplicate && strategy === 'return_existing') {
    return {
      ok: true,
      created: false,
      job: { id: duplicate.id, title: duplicate.title, company: duplicate.company },
      duplicate,
      extraction: { fieldsExtracted: extractedFieldList(data) },
    }
  }

  const countries = data.location
    ? data.location.split(',').map(s => s.trim()).filter(Boolean)
    : []

  const created = await prisma.jobApplication.create({
    data: {
      profileId,
      url,
      title,
      company,
      jobNumber: data.jobNumber ?? null,
      jobDescription: data.jobDescription ?? null,
      countries,
      datePublished: data.datePublished ?? null,
      notes: input.notes?.trim() || null,
      applicationSource: input.applicationSource ?? 'cold',
      salaryBand: data.salaryBand ?? null,
      // status + progress default to "not started"; intake doesn't auto-apply.
    },
    select: { id: true, title: true, company: true },
  })

  return {
    ok: true,
    created: true,
    job: created,
    duplicate, // null when no match; non-null when match existed but strategy was create_anyway
    extraction: { fieldsExtracted: extractedFieldList(data) },
  }
}

function extractedFieldList(data: {
  title?: string
  company?: string
  location?: string
  jobNumber?: string
  jobDescription?: string
  datePublished?: Date
  salaryBand?: string
}): string[] {
  return (
    [
      ['title', data.title],
      ['company', data.company],
      ['location', data.location],
      ['jobNumber', data.jobNumber],
      ['jobDescription', data.jobDescription],
      ['datePublished', data.datePublished],
      ['salaryBand', data.salaryBand],
    ] as const
  )
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k]) => k)
}
