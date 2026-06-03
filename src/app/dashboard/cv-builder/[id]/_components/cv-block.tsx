'use client'
import type { CVSection } from '@/modules/cv/schema'
type Props = { section: CVSection; onToggleVisibility: () => void; onCopy: () => void; children: React.ReactNode }
export function CvBlock({ children }: Props) { return <div>{children}</div> }
