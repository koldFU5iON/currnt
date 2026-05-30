import { expect, test } from "vitest"
import { ExtractedProfileSchema, emptyExtractedProfile } from "./schema"

test("schema parses a representative extracted profile", () => {
  const input = {
    contact: {
      name: "Devon Stanton",
      headline: "Senior Program Manager",
      location: "Le Chesnay, Île-de-France, France",
      email: "devon.stanton@gmail.com",
      phone: "+330610036295",
      linkedIn: "www.linkedin.com/in/devonstanton",
      website: null,
      github: null,
    },
    summary: "Some people tell the story. Some people build the stage.",
    experiences: [
      {
        company: "Unity",
        role: "Snr Program Manager",
        startDate: "2024-07",
        endDate: null,
        location: "France",
        remote: false,
        summary: "Promoted into global program ownership role.",
        activities: [
          { kind: "responsibility", description: "Lead global delivery of partner-facing initiatives", impact: null },
          { kind: "achievement", description: "Scaled campaign visibility infrastructure", impact: "40 → 5,000+ tracked projects" },
        ],
      },
    ],
    education: [
      { institution: "Vega", qualification: "Business Communications", field: "Branding", startDate: "2008", endDate: "2011" },
    ],
    certifications: [
      { name: "Learn SQL Course", issuer: null, issueDate: null },
    ],
    skills: [
      { name: "AI Fluency", category: null },
    ],
  }
  const parsed = ExtractedProfileSchema.parse(input)
  expect(parsed.experiences[0].activities[1].kind).toBe("achievement")
  expect(parsed.certifications[0].issuer).toBeNull()
})

test("emptyExtractedProfile is a valid parse", () => {
  expect(() => ExtractedProfileSchema.parse(emptyExtractedProfile)).not.toThrow()
})

test("schema rejects an invalid activity kind", () => {
  const bad = { ...emptyExtractedProfile, experiences: [{
    company: "X", role: "Y", startDate: "2020-01", endDate: null, location: null, remote: false, summary: null,
    activities: [{ kind: "duty", description: "z", impact: null }],
  }] }
  expect(() => ExtractedProfileSchema.parse(bad)).toThrow()
})
