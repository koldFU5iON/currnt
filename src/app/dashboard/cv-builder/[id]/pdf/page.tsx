import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/session'
import { getCV } from '@/modules/cv/queries'
import { PDFDocument } from '@/app/components/pdf-extract'

type Props = { params: Promise<{ id: string }> }

export default async function CVPrintPage({ params }: Props) {
  const { id } = await params
  const { profile } = await requireProfile()
  const cv = await getCV(id, profile.id)
  if (!cv) notFound()

  const cvWithMeta = { ...cv, profileName: cv.profile.name }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white print:p-0">
      <PDFDocument cv={cvWithMeta} />
    </div>
  )
}
