export type ChecklistSection = {
  heading: string
  prompts: string[]
}

export const CHECKLIST: readonly ChecklistSection[] = [
  {
    heading: 'Opening',
    prompts: [
      'Name the specific role in your first sentence — not "a position at your company".',
      'Lead with why this role caught your attention, not "I am writing to apply for…"',
      'Open with "you" energy: what you bring, not what you want.',
    ],
  },
  {
    heading: 'Company interest',
    prompts: [
      'Name one specific thing about the company — a product, mission, or recent news.',
      'Explain why that resonates with your own direction, not just "I admire your work".',
    ],
  },
  {
    heading: 'Your fit',
    prompts: [
      'Pick your single strongest piece of evidence. Make it specific: role, company, number, outcome.',
      'Connect that evidence directly to a requirement in the job description.',
      "If they list a must-have you're light on, address it — don't hope they won't notice.",
    ],
  },
  {
    heading: 'Closing',
    prompts: [
      'End with a confident, specific call to action — not "I look forward to hearing from you".',
      'Keep the closing short. One sentence is enough.',
    ],
  },
]
