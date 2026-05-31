import type { Job } from "@/app/types/job-application"

export type CompletenessLevel = "incomplete" | "thin" | "complete"

export type Completeness = {
  level: CompletenessLevel
  /** Human-readable labels of the fields that are missing. */
  missing: string[]
}

/** Only the fields that affect completeness — keeps the helper easy to test. */
export type CompletenessInput = Pick<
  Job,
  "jobDescription" | "salaryBand" | "url" | "countries"
>

/**
 * Derive a job's completeness from the data already on the row.
 *
 * - `incomplete` (red): no job description — can't assess fit against it.
 * - `thin` (amber): has a description but is missing useful context.
 * - `complete` (green): description plus the key supporting fields.
 *
 * The description is listed first among missing fields so the most important
 * gap surfaces at the top of the tooltip.
 */
export function jobCompleteness(job: CompletenessInput): Completeness {
  const hasDescription = !!job.jobDescription?.trim()

  const missing: string[] = []
  if (!hasDescription) missing.push("Job description")
  if (!job.salaryBand?.trim()) missing.push("Salary band")
  if (!job.url?.trim()) missing.push("Job URL")
  if (job.countries.length === 0) missing.push("Location")

  if (!hasDescription) return { level: "incomplete", missing }
  if (missing.length > 0) return { level: "thin", missing }
  return { level: "complete", missing: [] }
}
