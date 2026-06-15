import type { JobListing } from '../schema'
import * as greenhouse from './greenhouse'
import * as lever from './lever'
import * as ashby from './ashby'
import * as successfactors from './successfactors'
import * as workday from './workday'
import * as smartrecruiters from './smartrecruiters'
import * as bamboohr from './bamboohr'

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
  smartrecruiters,
  bamboohr,
}

export function getAdapter(provider: string): Adapter | null {
  return ADAPTERS[provider] ?? null
}
