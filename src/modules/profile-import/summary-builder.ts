type Activity = { kind: string; description: string }

type ExperienceInput = {
  role: string
  company: string
  startDate: Date
  endDate: Date | null
  activities: Activity[]
}

export function buildImportSummary(exp: ExperienceInput): string {
  if (exp.activities.length === 0) return ''

  const responsibilities = exp.activities.filter(a => a.kind === 'responsibility')
  const achievements = exp.activities.filter(a => a.kind === 'achievement')

  const sections: string[] = []

  if (responsibilities.length > 0) {
    sections.push('## Responsibilities')
    responsibilities.forEach(a => sections.push(`- ${a.description}`))
  }

  if (achievements.length > 0) {
    sections.push('## Achievements')
    achievements.forEach(a => sections.push(`- ${a.description}`))
  }

  return sections.join('\n')
}
