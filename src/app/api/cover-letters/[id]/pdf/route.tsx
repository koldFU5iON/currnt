import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { requireProfile } from '@/lib/session'
import { getCoverLetter } from '@/modules/cover-letters/queries'
import { CoverLetterPDFDocument } from '@/app/components/cover-letter-pdf-document'

export const maxDuration = 30

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const { profile } = await requireProfile()
  const letter = await getCoverLetter(profile.id, id)
  if (!letter) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buffer = await renderToBuffer(<CoverLetterPDFDocument content={letter.content} />)

  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '-')
  const nameSlug = safe(profile.name)
  const roleSlug = letter.jobTitle ? `-${safe(letter.jobTitle)}` : ''
  const companySlug = letter.company ? `_${safe(letter.company)}` : ''
  const filename = `${nameSlug}-Cover-Letter${roleSlug}${companySlug}.pdf`

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
