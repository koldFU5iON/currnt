import { describe, it, expect } from "vitest"
import { brand } from "./brand"

// Recursively collect every string value in the brand config.
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === "object") return Object.values(value).flatMap(strings)
  return []
}

describe("brand", () => {
  it("contains no em/en dashes (brand guide bans them)", () => {
    for (const s of strings(brand)) {
      expect(s, s).not.toMatch(/[—–]|&mdash;|&ndash;/)
    }
  })

  it("threads the name through name-bearing copy so a rename propagates", () => {
    expect(brand.metaDescription).toContain(brand.name)
    expect(brand.hero.body).toContain(brand.name)
  })

  it("defines the three brand-pillar features in order", () => {
    expect(brand.features.map((f) => f.pillar)).toEqual([
      "Structured",
      "Adaptive",
      "Current",
    ])
  })
})
