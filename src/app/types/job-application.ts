import type { JobApplication } from "@prisma/client"

export const ApplicationStatus = {
  NotStarted: "not started",
  Applied: "applied",
  Interviewing: "interviewing",
  Accepted: "accepted",
  Rejected: "rejected",
} as const

export type ApplicationStatusType = typeof ApplicationStatus[keyof typeof ApplicationStatus]

// The job is still live and being worked.
export const OpenStatuses = [
  ApplicationStatus.NotStarted,
  ApplicationStatus.Applied,
  ApplicationStatus.Interviewing,
] as const

// The job is closed — a final outcome was reached.
export const ClosedStatuses = [
  ApplicationStatus.Accepted,
  ApplicationStatus.Rejected,
] as const

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

export type ProfileType = {
  name: string,
  headline: string[],
  subHeadline: string[],
  links: ProfileLink[],
  contact: ProfileContact[],
  about: string,
  competency: string[],
}

type ProfileContact = {
  type: string
  value: string
}

type ProfileLink = {
  name: string
  url: string
}
