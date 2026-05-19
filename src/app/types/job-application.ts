import type { JobApplication } from "@prisma/client"

export const ApplicationStatus = {
  NotStarted: "not started",
  Applied: "applied",
  Interviewing: "interviewing",
  Rejected: "rejected",
} as const

export type ApplicationStatusType = typeof ApplicationStatus[keyof typeof ApplicationStatus]

export const ApplicationProgress = {
  NotStarted: "not started",
  Pending: "awaiting response",
  Recruiter: "recruiter screening",
  Interview: "interview",
  Project: "take-home project",
  Offer: "offer",
} as const

export type ApplicationProgressType = typeof ApplicationProgress[keyof typeof ApplicationProgress]

export type JobFit = {
  rating: number
  label: "poor" | "ok" | "stretch" | "good" | "excellent"
  justification: string
}

export type Job = Omit<JobApplication, "status" | "progress" | "jobFit"> & {
  status: ApplicationStatusType
  progress: ApplicationProgressType
  jobFit?: JobFit | null
}


