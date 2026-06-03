'use client'
import type { CVSection } from '@/modules/cv/schema'
type Props = { section: CVSection & { type: 'tools' }; onUpdate: (s: CVSection) => void }
export function ToolsBlock(_props: Props) { return null }
