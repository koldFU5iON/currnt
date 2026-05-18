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
  Offer: "offer"
}

export type ApplicationProgressType = typeof ApplicationProgress[keyof typeof ApplicationProgress]

export interface GridItemProps {
  id: string,
  jobFit?: JobFit,
  jobNumber?: string,
  title: string,
  url?: string,
  company: string,
  countries: string[],
  applied: Date,
  status: ApplicationStatusType,
  progress: ApplicationProgressType,
  lastUpdated: Date,

}

export type JobFit = {
  rating: number,
  label: "poor" | "ok" | "stretch" | "good" | "excellent",
  justification: string
}


