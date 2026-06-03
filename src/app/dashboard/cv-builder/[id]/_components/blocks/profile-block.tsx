'use client'
import type { CVSection } from '@/modules/cv/schema'
type Props = { section: CVSection & { type: 'profile' }; onUpdate: (s: CVSection) => void }
export function ProfileBlock(_props: Props) { return null }
