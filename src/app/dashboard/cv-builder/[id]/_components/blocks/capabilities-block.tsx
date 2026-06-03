'use client'
import type { CVSection } from '@/modules/cv/schema'
type Props = { section: CVSection & { type: 'capabilities' }; onUpdate: (s: CVSection) => void }
export function CapabilitiesBlock(_props: Props) { return null }
