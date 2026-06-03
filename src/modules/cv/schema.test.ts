import { describe, expect, it } from "vitest"
import { CVDocumentContentSchema, parseCVContent } from "./schema"

const headerSection = {
  id: "header",
  type: "header" as const,
  visible: true,
  data: { name: "Devon", headline: "Senior PM", contact: {} },
}

describe("CVDocumentContentSchema", () => {
  it("parses a minimal valid document", () => {
    const doc = { version: 1, sections: [] }
    expect(CVDocumentContentSchema.parse(doc)).toEqual(doc)
  })

  it("parses a document with a header section", () => {
    const doc = { version: 1, sections: [headerSection] }
    expect(CVDocumentContentSchema.parse(doc).sections).toHaveLength(1)
  })

  it("header subHeadline is optional", () => {
    const doc = { version: 1, sections: [headerSection] }
    expect(() => CVDocumentContentSchema.parse(doc)).not.toThrow()
  })

  it("rejects an unknown section type", () => {
    const bad = { version: 1, sections: [{ id: "x", type: "unknown", visible: true, data: {} }] }
    expect(() => CVDocumentContentSchema.parse(bad)).toThrow()
  })

  it("parses an experience section with multiple titles", () => {
    const doc = {
      version: 1,
      sections: [{
        id: "e1", type: "experience", visible: true,
        data: { company: "Unity", titles: ["Senior PM", "PM"], location: "Remote", duration: "2019–2023", description: "Led delivery.", outcomes: ["40% faster"] },
      }],
    }
    expect(CVDocumentContentSchema.parse(doc).sections[0].type).toBe("experience")
  })
})

describe("parseCVContent", () => {
  it("returns empty doc for empty object string", () => {
    expect(parseCVContent("{}")).toEqual({ version: 1, sections: [] })
  })

  it("returns empty doc for invalid JSON", () => {
    expect(parseCVContent("not-json")).toEqual({ version: 1, sections: [] })
  })

  it("parses a valid serialised document", () => {
    const doc = { version: 1, sections: [headerSection] }
    expect(parseCVContent(JSON.stringify(doc)).sections).toHaveLength(1)
  })
})
