'use client'
import type { CVSection, HeaderData } from '@/modules/cv/schema'
type Props = { section: CVSection & { type: 'header'; data: HeaderData }; onUpdate: (s: CVSection) => void }
export function HeaderBlock(_props: Props) { return null }
