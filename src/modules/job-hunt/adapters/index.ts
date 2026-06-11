import type { JobListing } from '../schema'
import * as greenhouse from './greenhouse'
import * as lever from './lever'
import * as ashby from './ashby'
import * as successfactors from './successfactors'
import * as workday from './workday'

type Adapter = {
  fetchJobList(slug: string): Promise<JobListing[]>
  fetchDescription(slug: string, jobId: string): Promise<string | null>
}

const ADAPTERS: Record<string, Adapter> = {
  greenhouse,
  lever,
  ashby,
  successfactors,
  workday,
}

export function getAdapter(provider: string): Adapter | null {
  return ADAPTERS[provider] ?? null
}
