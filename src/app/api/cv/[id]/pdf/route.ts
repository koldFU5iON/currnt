import { NextRequest, NextResponse } from 'next/server'
import { requireProfile } from '@/lib/session'
import { getCV } from '@/modules/cv/queries'
import { buildCVHtml } from '@/app/components/pdf-extract'
import puppeteer from 'puppeteer'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const { profile } = await requireProfile()
  const cv = await getCV(id, profile.id)
  if (!cv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const html = buildCVHtml({ ...cv, profileName: cv.profile.name })

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' },
    })

    const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '-')
    const nameSlug = safe(cv.profile.name)
    const roleSlug = cv.jobTitle ? `-${safe(cv.jobTitle)}` : ''
    const companySlug = cv.company ? `_${safe(cv.company)}` : ''
    const filename = `${nameSlug}-CV${roleSlug}${companySlug}.pdf`

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } finally {
    await browser.close()
  }
}
