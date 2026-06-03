'use client'
import type { CVSection } from '@/modules/cv/schema'
type Props = { section: CVSection & { type: 'competencies' }; onUpdate: (s: CVSection) => void }
export function CompetenciesBlock(_props: Props) { return null }
