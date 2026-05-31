const name = "currnt"

export const brand = {
  name,
  tagline: "Stay current.",
  metaDescription: `${name} keeps a structured record of your career and shapes it to fit each role you go after. Open source, bring your own AI key.`,
  hero: {
    eyebrow: "Stay current.",
    title: "Everything you've done, ready for what's next.",
    body: `${name} keeps a structured record of your career and shapes it to fit each role you go after. No job board. No templates. Just your work, presented clearly.`,
  },
  features: [
    {
      pillar: "Structured",
      title: "Structured, not templated",
      description:
        "Capture everything you've done as structured data: roles, skills, wins, without forcing your career into someone else's template.",
    },
    {
      pillar: "Adaptive",
      title: "Adapt to every role",
      description:
        "See how you fit an opportunity, then tailor what you present so each application reflects what that employer needs to see.",
    },
    {
      pillar: "Current",
      title: "Keep your search current",
      description:
        "Track every role you're chasing and keep your record up to date, so you're ready the moment something lands.",
    },
  ],
} as const
