import type { CVWithMeta } from '../dashboard/cv-builder/[id]/_components/cv-editor'
import type { CVSection, HeaderData, ExperienceData, EducationData, CertificationData, LanguagesData } from '@/modules/cv/schema'

type Props = { cv: CVWithMeta }

const SECTION_LABELS: Record<string, string> = {
  profile: 'Profile',
  competencies: 'Core Competencies',
  capabilities: 'Key Capabilities',
  experience: 'Professional Experience',
  education: 'Education',
  certification: 'Certifications',
  skills: 'Skills',
  tools: 'Tools & Technologies',
  languages: 'Languages',
}

export function PDFDocument({ cv }: Props) {
  const visibleSections = cv.content.sections.filter(s => s.visible)
  const header = visibleSections.find(s => s.type === 'header')
  const body = visibleSections.filter(s => s.type !== 'header')

  const seenTypes = new Set<string>()

  return (
    <main className="mx-auto w-[210mm] min-h-[297mm] bg-white text-black px-[14mm] py-[12mm] text-[10.5pt] leading-snug font-sans">
      {header && (() => {
        const d = header.data as HeaderData
        const contactItems = [d.contact.email, d.contact.phone, d.contact.linkedin, d.contact.website].filter(Boolean)
        return (
          <header className="border-b border-black pb-3 mb-4">
            <h1 className="text-[22pt] font-bold leading-none">{d.name}</h1>
            <p className="mt-0.5 text-[11pt]">{d.headline}</p>
            {d.subHeadline && <p className="text-[10pt] font-medium">{d.subHeadline}</p>}
            {contactItems.length > 0 && (
              <p className="mt-1 text-[9pt] text-gray-600">{contactItems.join(' · ')}</p>
            )}
          </header>
        )
      })()}

      {body.map((section, i) => {
        const isFirst = !seenTypes.has(section.type)
        seenTypes.add(section.type)
        return <PDFSection key={i} section={section} showHeading={isFirst} />
      })}
    </main>
  )
}

function PDFSection({ section, showHeading }: { section: CVSection; showHeading: boolean }) {
  const label = SECTION_LABELS[section.type]

  return (
    <section className="mb-4">
      {showHeading && label && (
        <div className="border-b border-black pb-0.5 mb-2">
          <h2 className="text-[9pt] font-bold uppercase tracking-wider">{label}</h2>
        </div>
      )}
      <PDFSectionBody section={section} />
    </section>
  )
}

function PDFSectionBody({ section }: { section: CVSection }) {
  switch (section.type) {
    case 'profile':
      return <p>{section.data.content}</p>

    case 'competencies':
    case 'capabilities':
      return (
        <ul className="list-disc pl-4 columns-2 gap-4">
          {section.data.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )

    case 'experience': {
      const d = section.data as ExperienceData
      return (
        <div className="mb-2">
          <div className="flex justify-between items-baseline gap-4">
            <p className="font-bold">{d.company}</p>
            <p className="text-[9pt] text-right whitespace-nowrap shrink-0">{d.duration} · {d.location}</p>
          </div>
          <p className="italic text-[9.5pt]">{d.titles.join(' → ')}</p>
          {d.description && <p className="mt-1 text-[9.5pt]">{d.description}</p>}
          {d.outcomes.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {d.outcomes.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0">→</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    }

    case 'education': {
      const d = section.data as EducationData
      return (
        <div className="flex justify-between items-baseline gap-4">
          <div>
            <p className="font-bold">{d.institution}</p>
            <p>{d.qualification}{d.field ? `, ${d.field}` : ''}{d.grade ? ` — ${d.grade}` : ''}</p>
          </div>
          <p className="text-[9pt] text-right whitespace-nowrap shrink-0">{d.duration}</p>
        </div>
      )
    }

    case 'certification': {
      const d = section.data as CertificationData
      return (
        <div className="flex justify-between items-baseline gap-4">
          <p>{d.name}{d.issuer ? ` · ${d.issuer}` : ''}</p>
          {d.date && <p className="text-[9pt] whitespace-nowrap shrink-0">{d.date}</p>}
        </div>
      )
    }

    case 'skills':
    case 'tools':
      return <p>{section.data.items.join(' · ')}</p>

    case 'languages': {
      const d = section.data as LanguagesData
      return (
        <p>{d.items.map(l => `${l.name} (${l.proficiency})`).join(' · ')}</p>
      )
    }

    default:
      return null
  }
}

// ── HTML string builder for Puppeteer ────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderSectionBodyHtml(section: CVSection): string {
  switch (section.type) {
    case 'profile':
      return `<p>${esc(section.data.content)}</p>`

    case 'competencies':
    case 'capabilities':
      return `<ul class="two-col">${section.data.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`

    case 'experience': {
      const d = section.data as ExperienceData
      return `
        <div class="job">
          <div class="row">
            <strong>${esc(d.company)}</strong>
            <span class="meta">${esc(d.duration)} · ${esc(d.location)}</span>
          </div>
          <em class="meta">${esc(d.titles.join(' → '))}</em>
          ${d.description ? `<p class="meta">${esc(d.description)}</p>` : ''}
          ${d.outcomes.length ? `<ul class="outcomes">${d.outcomes.map(o => `<li><span class="arrow">→</span>${esc(o)}</li>`).join('')}</ul>` : ''}
        </div>`
    }

    case 'education': {
      const d = section.data as EducationData
      return `
        <div class="row">
          <div>
            <strong>${esc(d.institution)}</strong>
            <p class="meta">${esc(d.qualification)}${d.field ? `, ${esc(d.field)}` : ''}${d.grade ? ` — ${esc(d.grade)}` : ''}</p>
          </div>
          <span class="meta">${esc(d.duration)}</span>
        </div>`
    }

    case 'certification': {
      const d = section.data as CertificationData
      return `
        <div class="row">
          <span>${esc(d.name)}${d.issuer ? ` · ${esc(d.issuer)}` : ''}</span>
          ${d.date ? `<span class="meta">${esc(d.date)}</span>` : ''}
        </div>`
    }

    case 'skills':
    case 'tools':
      return `<p>${section.data.items.map(esc).join(' · ')}</p>`

    case 'languages': {
      const d = section.data as LanguagesData
      return `<p>${d.items.map(l => `${esc(l.name)} (${esc(l.proficiency)})`).join(' · ')}</p>`
    }

    default:
      return ''
  }
}

export function buildCVHtml(cv: CVWithMeta): string {
  const visibleSections = cv.content.sections.filter(s => s.visible)
  const header = visibleSections.find(s => s.type === 'header')
  const body = visibleSections.filter(s => s.type !== 'header')

  const seenTypes = new Set<string>()

  let headerHtml = ''
  if (header) {
    const d = header.data as HeaderData
    const contactItems = [d.contact.email, d.contact.phone, d.contact.linkedin, d.contact.website]
      .filter((v): v is string => !!v).map(esc)
    headerHtml = `
      <header>
        <h1>${esc(d.name)}</h1>
        <p class="headline">${esc(d.headline)}</p>
        ${d.subHeadline ? `<p class="subheadline">${esc(d.subHeadline)}</p>` : ''}
        ${contactItems.length ? `<p class="contact">${contactItems.join(' · ')}</p>` : ''}
      </header>`
  }

  const bodyHtml = body.map(section => {
    const label = SECTION_LABELS[section.type]
    const isFirst = !seenTypes.has(section.type)
    seenTypes.add(section.type)
    return `
      <section>
        ${isFirst && label ? `<div class="section-heading"><h2>${esc(label)}</h2></div>` : ''}
        ${renderSectionBodyHtml(section)}
      </section>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #000;
    background: #fff;
    width: 210mm;
  }
  header {
    border-bottom: 1.5px solid #000;
    padding-bottom: 8px;
    margin-bottom: 14px;
  }
  h1 { font-size: 22pt; font-weight: bold; line-height: 1.1; }
  .headline { font-size: 11pt; margin-top: 2px; }
  .subheadline { font-size: 10pt; font-weight: 600; margin-top: 1px; }
  .contact { font-size: 9pt; color: #444; margin-top: 5px; }
  section { margin-bottom: 14px; }
  .section-heading { border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 6px; }
  .section-heading h2 { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.07em; }
  p { margin-bottom: 2px; }
  .meta { font-size: 9.5pt; color: #222; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .row .meta { flex-shrink: 0; text-align: right; white-space: nowrap; }
  em.meta { display: block; margin-top: 1px; }
  .job { margin-bottom: 10px; }
  ul { list-style: none; padding: 0; }
  ul.two-col { columns: 2; column-gap: 20px; }
  ul.two-col li::before { content: "•"; margin-right: 4px; }
  ul.two-col li { margin-bottom: 2px; break-inside: avoid; }
  ul.outcomes { margin-top: 4px; }
  ul.outcomes li { display: flex; gap: 8px; margin-bottom: 2px; }
  .arrow { flex-shrink: 0; }
</style>
</head>
<body>
${headerHtml}
${bodyHtml}
</body>
</html>`
}
