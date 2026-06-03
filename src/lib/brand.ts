const name = "currnt"
const tagline = "Stay current."
const githubUrl = "https://github.com/koldFU5iON/resume"

export const brand = {
  name,
  tagline,
  githubUrl,
  metaDescription: `${name} keeps a structured record of your career and shapes it to fit each role you go after. Open source, bring your own AI key.`,
  hero: {
    eyebrow: tagline,
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
  about: {
    opening: {
      line1: "AI is reshaping every industry.",
      line2: "Somewhere in the rush, your career became something that happens to you — not something you own.",
    },
    moment:
      "Hiring is faster, noisier, and more competitive than it has ever been. AI is compressing timelines, automating screening, and making it harder to stand out with a static document. Most people are being evaluated before they have had a chance to show what they actually bring.",
    response:
      "currnt is built on a different premise: AI should be a companion in your career, not a replacement for your judgment. The goal is not to automate your identity — it is to surface what is already there and help you communicate it with precision. You bring your experience. currnt helps you show the critical impact behind it.",
    philosophy: {
      body: "Modern careers are no longer ladders. They are currents — they shift, adapt, accelerate, slow down, branch, and evolve. The professionals who thrive are not always the strongest or most experienced. They are the most adaptable.",
      missingE:
        "The name reflects this. currnt. The missing E is deliberate. Every person arrives with something they are pursuing: a new role, a new skill, a new direction. The missing letter represents that potential. Your story is still being written.",
    },
    beliefs: [
      {
        label: "Adaptive",
        body: "Modern professionals are multidimensional. You work across operations, communication, product, strategy, and creative — sometimes all at once. currnt reflects that reality rather than forcing your career into someone else's template.",
      },
      {
        label: "Structured",
        body: "People forget their own value. currnt turns fragmented experience into organised achievements, reusable evidence, and a structured career memory you can draw from at any time.",
      },
      {
        label: "Current",
        body: "Careers evolve constantly. currnt is built to move with you — capturing new experience as it happens and keeping your record relevant so you are ready when the right opportunity arrives.",
      },
      {
        label: "User-Owned",
        body: "Your professional identity belongs to you. currnt is open source. You bring your own AI key, choose your workflows, and control your data. The intelligence runs on your account, not ours.",
      },
    ],
    openSource:
      "You are not feeding your career into a black box. currnt is open source, auditable, and bring-your-own-key. The AI runs on your account. You see everything it does. You approve everything it outputs.",
    cta: {
      heading: "Take control of your career narrative.",
      primary: { label: "Get started free", href: "/sign-up" },
      secondary: { label: "View on GitHub", href: githubUrl },
    },
  },
} as const
