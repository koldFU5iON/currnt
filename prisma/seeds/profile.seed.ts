// Seed content for the test user's profile context store.
// Experiences carry nested RoleActivities (kind: "responsibility" | "achievement").

export const experiences = [
  {
    company: "Blizzard Entertainment",
    role: "Snr. PR Manager",
    startDate: new Date("2016-11-01"),
    endDate: new Date("2025-03-01"),
    location: "Versailles, France",
    remote: false,
    summary:
      "Strategic lead for Blizzard's European organisation across eight markets. Primary bridge between EU country teams and global leadership across program governance, budget management, and cross-functional delivery.",
    activities: [
      {
        kind: "responsibility",
        description:
          "Owned the EU program governance model — steering committee cadence, stage-gate reviews, and reporting lines across eight country teams.",
        order: 0,
      },
      {
        kind: "responsibility",
        description:
          "Managed the regional program budget and resourcing forecasts in partnership with finance and country leads.",
        order: 1,
      },
      {
        kind: "responsibility",
        description:
          "Acted as the primary escalation point between EU delivery teams and global leadership.",
        order: 2,
      },
      {
        kind: "achievement",
        description:
          "Led the cross-market rollout of a unified release-readiness process adopted by all eight EU territories.",
        impact:
          "Cut launch-blocking issues by roughly 40% across the first four titles shipped under the new process.",
        highlighted: true,
        order: 3,
      },
      {
        kind: "achievement",
        description: "Restructured the regional reporting stack into a single program dashboard.",
        impact: "Reduced weekly status-reporting effort for country teams by roughly a day per cycle.",
        order: 4,
      },
      {
        kind: "achievement",
        description:
          "Drove the operational integration of a newly acquired studio into Blizzard's EU delivery model.",
        impact: "Brought the studio to full delivery cadence two months ahead of the integration plan.",
        highlighted: true,
        order: 5,
      },
    ],
  },
  {
    company: "Unity Technologies",
    role: "Program Manager",
    startDate: new Date("2013-06-01"),
    endDate: new Date("2016-10-01"),
    location: "Paris, France",
    remote: false,
    summary:
      "Ran cross-functional delivery programs for the engine's live-services roadmap, coordinating engineering, QA, and documentation against fixed release dates.",
    activities: [
      {
        kind: "responsibility",
        description: "Coordinated multi-team delivery schedules for the engine's live-services roadmap.",
        order: 0,
      },
      {
        kind: "responsibility",
        description: "Maintained the cross-functional risk register and ran fortnightly risk reviews.",
        order: 1,
      },
      {
        kind: "achievement",
        description: "Established Unity's first standardized program intake and prioritization process.",
        impact: "Gave leadership a single ranked view of around 30 in-flight initiatives for the first time.",
        highlighted: true,
        order: 2,
      },
      {
        kind: "achievement",
        description: "Ran the delivery program for a major editor release across engineering, QA, and docs.",
        impact: "Shipped on the committed date with zero P0 regressions at launch.",
        order: 3,
      },
    ],
  },
]

export const skills = [
  { name: "Jira", category: "Tools", level: "Expert", yearsOfExperience: 10 },
  { name: "Confluence", category: "Tools", level: "Advanced", yearsOfExperience: 10 },
  { name: "Smartsheet", category: "Tools", level: "Advanced", yearsOfExperience: 6 },
  { name: "Roadmapping", category: "Delivery", level: "Expert", yearsOfExperience: 12 },
  { name: "Budget Management", category: "Delivery", level: "Advanced", yearsOfExperience: 9 },
  { name: "Risk Management", category: "Delivery", level: "Expert", yearsOfExperience: 12 },
]

// Placeholder — replace with real education details.
export const educations = [
  {
    institution: "University of Example",
    qualification: "BSc",
    field: "Business Information Systems",
    startDate: new Date("2005-09-01"),
    endDate: new Date("2008-06-01"),
  },
]

export const languages = [
  { name: "English", proficiency: "native", order: 0 },
  { name: "French", proficiency: "professional", order: 1 },
]

export const competencies = [
  { name: "Program Governance", origin: "manual", order: 0 },
  { name: "Multi-Stream Delivery", origin: "manual", order: 1 },
  { name: "Operational Change & Adoption", origin: "manual", order: 2 },
  { name: "Stakeholder Management", origin: "manual", order: 3 },
]
