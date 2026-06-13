// src/modules/job-hunt/board-adapters/index.ts
import type { BoardJobListing, JobHuntSearchCriteria } from '../board-sources/schema'
import * as remotive from './remotive'
import * as remoteok from './remoteok'
import * as adzuna from './adzuna'
import * as jsearch from './jsearch'

export type BoardAdapter = {
  isAvailable(apiKey?: string | null): boolean
  fetchJobs(criteria: JobHuntSearchCriteria, apiKey?: string | null): Promise<BoardJobListing[]>
}

const ADAPTERS: Record<string, BoardAdapter> = {
  remotive: {
    isAvailable: () => remotive.isAvailable(),
    fetchJobs: (c) => remotive.fetchJobs(c),
  },
  remoteok: {
    isAvailable: () => remoteok.isAvailable(),
    fetchJobs: (c) => remoteok.fetchJobs(c),
  },
  adzuna: {
    isAvailable: () => adzuna.isAvailable(),
    fetchJobs: (c) => adzuna.fetchJobs(c),
  },
  jsearch: {
    isAvailable: (apiKey) => jsearch.isAvailable(apiKey ?? null),
    fetchJobs: (c, apiKey) => jsearch.fetchJobs(c, apiKey ?? ''),
  },
}

export function getBoardAdapter(provider: string): BoardAdapter | null {
  return ADAPTERS[provider] ?? null
}
