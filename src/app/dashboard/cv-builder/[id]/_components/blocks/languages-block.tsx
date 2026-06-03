'use client'
import type { CVSection, LanguagesData } from '@/modules/cv/schema'
type Props = { section: CVSection & { type: 'languages'; data: LanguagesData }; onUpdate: (s: CVSection) => void }
export function LanguagesBlock(_props: Props) { return null }
