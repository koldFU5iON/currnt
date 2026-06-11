import { describe, it, expect } from "vitest"
import { JobFitSchema } from "./schema"

const base = { rating: 7, justification: "Strong match." }

describe("JobFitSchema label", () => {
  it.each(["reach", "possible", "stretch", "solid", "standout"])(
    "accepts '%s'",
    (label) => {
      expect(JobFitSchema.safeParse({ ...base, label }).success).toBe(true)
    },
  )

  it.each(["unlikely", "weak", "good", "excellent", "poor", "ok"])(
    "rejects old/invalid label '%s'",
    (label) => {
      expect(JobFitSchema.safeParse({ ...base, label }).success).toBe(false)
    },
  )
})
