'use client'
import type { CVSection } from '@/modules/cv/schema'
type Props = { section: CVSection & { type: 'skills' }; onUpdate: (s: CVSection) => void }
export function SkillsBlock(_props: Props) { return null }
