'use client'
import type { CVSection, ExperienceData } from '@/modules/cv/schema'
type Props = { section: CVSection & { type: 'experience'; data: ExperienceData }; onUpdate: (s: CVSection) => void }
export function ExperienceBlock(_props: Props) { return null }
