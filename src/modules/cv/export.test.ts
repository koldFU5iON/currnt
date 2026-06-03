import { describe, expect, it } from "vitest"
import { toMarkdown, toText, sectionToPlainText } from "./export"
import type { CVDocumentContent, CVSection } from "./schema"

const doc: CVDocumentContent = {
  version: 1,
  sections: [
    {
      id: "h", type: "header", visible: true,
      data: { name: "Devon Stanton", headline: "Senior PM", contact: { email: "d@d.com", phone: "+44 7700" } },
    },
    {
      id: "p", type: "profile", visible: true,
      data: { content: "**Experienced** PM with 15+ years." },
    },
    {
      id: "e1", type: "experience", visible: true,
      data: { company: "Unity", titles: ["Senior PM", "PM"], location: "Remote", duration: "2019–2023", description: "Led delivery.", outcomes: ["40% faster cycles", "Saved $2M"] },
    },
    {
      id: "lang", type: "languages", visible: false,
      data: { items: [{ name: "English", proficiency: "native" }] },
    },
  ],
}

describe("toMarkdown", () => {
  it("includes name from header", () => {
    expect(toMarkdown(doc)).toContain("Devon Stanton")
  })

  it("includes experience company", () => {
    expect(toMarkdown(doc)).toContain("Unity")
  })

  it("includes promotion chain in titles", () => {
    expect(toMarkdown(doc)).toContain("Senior PM → PM")
  })

  it("prefixes outcomes with arrow", () => {
    expect(toMarkdown(doc)).toContain("→ 40% faster cycles")
  })

  it("excludes hidden sections", () => {
    expect(toMarkdown(doc)).not.toContain("English")
  })
})

describe("toText", () => {
  it("strips markdown bold markers", () => {
    const text = toText(doc)
    expect(text).not.toContain("**")
    expect(text).toContain("Experienced PM")
  })
})

describe("sectionToPlainText", () => {
  it("serialises a competencies section", () => {
    const section: CVSection = {
      id: "c", type: "competencies", visible: true,
      data: { items: ["Stakeholder management", "Risk governance"] },
    }
    const text = sectionToPlainText(section)
    expect(text).toContain("Stakeholder management")
    expect(text).toContain("Risk governance")
  })
})
