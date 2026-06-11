import type { JobListing } from '../schema'

// SAP SuccessFactors does not expose a public job listing REST API — the career
// portal is a JavaScript SPA backed by an authenticated OData API. Scanning is
// not yet supported. Detection and watchlist tracking work correctly; this stub
// exists so getAdapter('successfactors') returns an adapter rather than null,
// which would surface a misleading "no ATS detected" error in the UI.
export async function fetchJobList(_companySlug: string): Promise<JobListing[]> {
  throw new Error('SAP SuccessFactors scanning is not yet supported')
}

export async function fetchDescription(_companySlug: string, _jobId: string): Promise<string | null> {
  return null
}
