import { describe, it, expect } from "vitest"
import { jobCompleteness, type CompletenessInput } from "./completeness"

const complete: CompletenessInput = {
  jobDescription: "Build and ship things.",
  salaryBand: "$120–140k",
  url: "https://example.com/job",
  countries: ["United Kingdom"],
}

describe("jobCompleteness", () => {
  it("is complete when the description and key fields are present", () => {
    expect(jobCompleteness(complete)).toEqual({ level: "complete", missing: [] })
  })

  it("is incomplete (red) when the description is missing", () => {
    const result = jobCompleteness({ ...complete, jobDescription: null })
    expect(result.level).toBe("incomplete")
    expect(result.missing).toContain("Job description")
  })

  it("treats a whitespace-only description as missing", () => {
    expect(jobCompleteness({ ...complete, jobDescription: "   " }).level).toBe(
      "incomplete",
    )
  })

  it("is thin (amber) when the description is present but optional fields are missing", () => {
    const result = jobCompleteness({ ...complete, salaryBand: null, url: null })
    expect(result.level).toBe("thin")
    expect(result.missing).toEqual(
      expect.arrayContaining(["Salary band", "Job URL"]),
    )
    expect(result.missing).not.toContain("Job description")
  })

  it("counts an empty location as a missing optional field", () => {
    expect(jobCompleteness({ ...complete, countries: [] }).level).toBe("thin")
  })

  it("lists the description first when incomplete", () => {
    const result = jobCompleteness({
      jobDescription: "",
      salaryBand: null,
      url: null,
      countries: [],
    })
    expect(result.level).toBe("incomplete")
    expect(result.missing[0]).toBe("Job description")
  })
})
