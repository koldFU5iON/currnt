import { describe, it, expect } from "vitest"
import { badgeVariants } from "./badge"

describe("badgeVariants status variants", () => {
  it("success is a tinted emerald (no white text)", () => {
    const cls = badgeVariants({ variant: "success" })
    expect(cls).toContain("bg-emerald-500/15")
    expect(cls).toContain("text-emerald-700")
    expect(cls).toContain("dark:text-emerald-400")
    expect(cls).not.toContain("text-white")
  })

  it("warning is a tinted amber", () => {
    const cls = badgeVariants({ variant: "warning" })
    expect(cls).toContain("bg-amber-500/15")
    expect(cls).toContain("text-amber-700")
    expect(cls).toContain("dark:text-amber-400")
  })

  it("info is a tinted sky", () => {
    const cls = badgeVariants({ variant: "info" })
    expect(cls).toContain("bg-sky-500/15")
    expect(cls).toContain("text-sky-700")
    expect(cls).toContain("dark:text-sky-400")
  })
})
