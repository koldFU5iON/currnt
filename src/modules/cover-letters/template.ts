type ProfileHeader = {
  name: string
  headline?: string | null
  email?: string | null
  phone?: string | null
  linkedIn?: string | null
  website?: string | null
}

export function buildCoverLetterTemplate(profile: ProfileHeader): string {
  const lines: string[] = []

  lines.push(`# ${profile.name}`)

  if (profile.headline) {
    lines.push(`**${profile.headline}**`)
  }

  const contact = [profile.email, profile.phone, profile.linkedIn, profile.website]
    .filter(Boolean)
    .join(' · ')
  if (contact) lines.push(contact)

  lines.push('', '---', '', 'Dear Hiring Manager,', '', '')

  return lines.join('\n')
}
