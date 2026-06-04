import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { requireProfile } from '@/lib/session'
import { getCV } from '@/modules/cv/queries'
import { CVPDFDocument } from '@/app/components/cv-pdf-document'

export const maxDuration = 30

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const { profile } = await requireProfile()
  const cv = await getCV(id, profile.id)
  if (!cv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const cvWithMeta = { ...cv, profileName: cv.profile.name }
  const buffer = await renderToBuffer(<CVPDFDocument cv={cvWithMeta} />)

  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '-')
  const nameSlug = safe(cv.profile.name)
  const roleSlug = cv.jobTitle ? `-${safe(cv.jobTitle)}` : ''
  const companySlug = cv.company ? `_${safe(cv.company)}` : ''
  const filename = `${nameSlug}-CV${roleSlug}${companySlug}.pdf`

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
