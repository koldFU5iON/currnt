import { describe, it, expect } from "vitest"
import { JobFitSchema } from "./schema"

const base = { rating: 7, justification: "Strong match." }

describe("JobFitSchema label", () => {
  it.each(["unlikely", "weak", "stretch", "good", "excellent"])(
    "accepts '%s'",
    (label) => {
      expect(JobFitSchema.safeParse({ ...base, label }).success).toBe(true)
    },
  )

  it.each(["poor", "ok", "bad"])(
    "rejects old/invalid label '%s'",
    (label) => {
      expect(JobFitSchema.safeParse({ ...base, label }).success).toBe(false)
    },
  )
})
