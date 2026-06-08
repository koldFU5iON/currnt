type Props = {
  letter: {
    id: string
    content: string
    jobApplication?: { jobDescription?: string | null } | null
  }
  onBack: () => void
}

export function GenerateMode({ letter, onBack }: Props) {
  return <div>Generate (coming soon)</div>
}
