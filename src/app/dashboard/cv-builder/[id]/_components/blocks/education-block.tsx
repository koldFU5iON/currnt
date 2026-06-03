'use client'
import type { CVSection, EducationData } from '@/modules/cv/schema'
type Props = { section: CVSection & { type: 'education'; data: EducationData }; onUpdate: (s: CVSection) => void }
export function EducationBlock(_props: Props) { return null }
