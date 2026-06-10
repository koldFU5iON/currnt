import type { JobListing } from '../schema'
import * as greenhouse from './greenhouse'
import * as lever from './lever'
import * as ashby from './ashby'

type Adapter = {
  fetchJobList(slug: string): Promise<JobListing[]>
  fetchDescription(slug: string, jobId: string): Promise<string | null>
}

const ADAPTERS: Record<string, Adapter> = {
  greenhouse,
  lever,
  ashby,
}

export function getAdapter(provider: string): Adapter | null {
  return ADAPTERS[provider] ?? null
}
