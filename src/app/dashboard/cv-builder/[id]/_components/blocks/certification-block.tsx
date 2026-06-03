'use client'
import type { CVSection, CertificationData } from '@/modules/cv/schema'
type Props = { section: CVSection & { type: 'certification'; data: CertificationData }; onUpdate: (s: CVSection) => void }
export function CertificationBlock(_props: Props) { return null }
