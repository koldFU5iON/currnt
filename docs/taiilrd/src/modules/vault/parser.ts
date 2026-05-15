// ============================================================
// TAIILRD — Markdown Vault Parser
// Handles reading and writing profile markdown files.
// Each file = YAML frontmatter (structured) + markdown body (prose).
// ============================================================

import type { VaultFile, VaultFileType } from '@/types'

// ------------------------------------------------------------
// Frontmatter templates — what each file type expects
// These are the structural anchors. The body is freeform prose.
// ------------------------------------------------------------

export const VAULT_FRONTMATTER_TEMPLATES: Record<VaultFileType, Record<string, unknown>> = {
  skill: {
    type: 'skill',
    name: '',
    category: 'technical', // technical | soft | domain | tool | language
    level: 'proficient',   // familiar | proficient | expert
    yearsOfExperience: null,
    tags: [],
  },
  experience: {
    type: 'experience',
    company: '',
    role: '',
    startDate: '',        // YYYY-MM-DD
    endDate: null,        // null = current
    location: '',
    remote: false,
    tags: [],
    skills: [],           // skill names for cross-reference
  },
  project: {
    type: 'project',
    name: '',
    url: null,
    repoUrl: null,
    startDate: null,
    endDate: null,
    status: 'active',     // active | completed | archived
    tags: [],
    skills: [],
    highlights: [],       // key wins as bullet points
  },
  education: {
    type: 'education',
    institution: '',
    qualification: '',
    field: '',
    startDate: '',
    endDate: null,
    grade: null,
    tags: [],
  },
  certification: {
    type: 'certification',
    name: '',
    issuer: '',
    issueDate: '',
    expiryDate: null,
    credentialUrl: null,
    skills: [],
    tags: [],
  },
}

// ------------------------------------------------------------
// Parser — converts raw markdown string to VaultFile
// ------------------------------------------------------------

export function parseVaultFile(content: string, filePath: string): VaultFile {
  const { frontmatter, body } = splitFrontmatter(content)
  const type = frontmatter.type as VaultFileType

  if (!type || !VAULT_FRONTMATTER_TEMPLATES[type]) {
    throw new VaultParseError(
      `Invalid or missing "type" in frontmatter. Expected one of: ${Object.keys(VAULT_FRONTMATTER_TEMPLATES).join(', ')}`,
      filePath
    )
  }

  const slug = filePathToSlug(filePath)

  return {
    type,
    slug,
    frontmatter,
    body: body.trim(),
    filePath,
  }
}

// ------------------------------------------------------------
// Serialiser — converts VaultFile back to markdown string
// ------------------------------------------------------------

export function serialiseVaultFile(file: VaultFile): string {
  const frontmatterStr = serialiseFrontmatter(file.frontmatter)
  const body = file.body.trim()

  return `---\n${frontmatterStr}---\n\n${body}\n`
}

// ------------------------------------------------------------
// Template generator — creates a blank file for a given type
// ------------------------------------------------------------

export function createVaultFileTemplate(type: VaultFileType, name: string): string {
  const frontmatter = {
    ...VAULT_FRONTMATTER_TEMPLATES[type],
    name: name,
  }

  const bodyPlaceholders: Record<VaultFileType, string> = {
    skill: `## Notes\n\nDescribe your experience with this skill. Include context, how you've applied it, and any notable projects or outcomes.\n`,
    experience: `## Summary\n\nBrief overview of your role and responsibilities.\n\n## Achievements\n\n- Achievement one with measurable impact\n- Achievement two with measurable impact\n`,
    project: `## Overview\n\nWhat is this project and why does it exist?\n\n## Your Role\n\nWhat did you build or contribute?\n\n## Outcome\n\nWhat was the result or impact?\n`,
    education: `## Notes\n\nAnything relevant — dissertation topic, notable modules, extracurricular involvement.\n`,
    certification: `## Notes\n\nContext around why you pursued this certification and how you've applied the knowledge.\n`,
  }

  return `---\n${serialiseFrontmatter(frontmatter)}---\n\n${bodyPlaceholders[type]}`
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function splitFrontmatter(content: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)

  if (!match) {
    return { frontmatter: {}, body: content }
  }

  try {
    const frontmatter = parseYAML(match[1])
    const body = match[2] || ''
    return { frontmatter, body }
  } catch {
    return { frontmatter: {}, body: content }
  }
}

// Minimal YAML parser — handles the subset we need
// For production, swap with the 'js-yaml' package
function parseYAML(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.split('\n')

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const match = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/)

    if (!match) {
      i++
      continue
    }

    const key = match[1]
    const rawValue = match[2].trim()

    // Array value starting on next lines
    if (rawValue === '' || rawValue === '[]') {
      const arrayItems: string[] = []
      i++
      while (i < lines.length && lines[i].match(/^\s+-\s+/)) {
        arrayItems.push(lines[i].replace(/^\s+-\s+/, '').trim())
        i++
      }
      result[key] = arrayItems
      continue
    }

    // Inline array
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1)
      result[key] = inner
        ? inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        : []
      i++
      continue
    }

    // Boolean
    if (rawValue === 'true') { result[key] = true; i++; continue }
    if (rawValue === 'false') { result[key] = false; i++; continue }
    if (rawValue === 'null' || rawValue === '~') { result[key] = null; i++; continue }

    // Number
    const num = Number(rawValue)
    if (!isNaN(num) && rawValue !== '') { result[key] = num; i++; continue }

    // String — strip quotes if present
    result[key] = rawValue.replace(/^['"]|['"]$/g, '')
    i++
  }

  return result
}

function serialiseFrontmatter(frontmatter: Record<string, unknown>): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === null || value === undefined) {
      lines.push(`${key}: null`)
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`)
      } else {
        lines.push(`${key}:`)
        for (const item of value) {
          lines.push(`  - ${item}`)
        }
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`)
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`)
    } else {
      // Quote strings that contain special characters
      const str = String(value)
      const needsQuotes = /[:#\[\]{}&*!|>'"%@`,]/.test(str) || str.includes('\n')
      lines.push(`${key}: ${needsQuotes ? `"${str.replace(/"/g, '\\"')}"` : str}`)
    }
  }

  return lines.join('\n') + '\n'
}

function filePathToSlug(filePath: string): string {
  return filePath
    .split('/')
    .pop()
    ?.replace(/\.md$/, '')
    .toLowerCase()
    .replace(/\s+/g, '-') ?? filePath
}

// ------------------------------------------------------------
// Profile data extractor
// Pulls structured data from parsed vault files for LLM context
// ------------------------------------------------------------

export function extractProfileContext(files: VaultFile[]): string {
  const sections: string[] = []

  const byType = (type: VaultFileType) => files.filter((f) => f.type === type)

  // Skills
  const skills = byType('skill')
  if (skills.length) {
    sections.push('## Skills\n')
    for (const s of skills) {
      const fm = s.frontmatter
      sections.push(
        `### ${fm.name} (${fm.level}, ${fm.category})` +
        (fm.yearsOfExperience ? ` — ${fm.yearsOfExperience} years` : '') +
        (s.body ? `\n${s.body}` : '')
      )
    }
  }

  // Experience
  const experiences = byType('experience')
  if (experiences.length) {
    sections.push('\n## Work Experience\n')
    for (const e of experiences) {
      const fm = e.frontmatter
      const dates = `${fm.startDate} – ${fm.endDate ?? 'Present'}`
      sections.push(
        `### ${fm.role} at ${fm.company} (${dates})` +
        (fm.location ? ` | ${fm.location}${fm.remote ? ' (Remote)' : ''}` : '') +
        (s.body ? `\n${e.body}` : '')
      )
    }
  }

  // Projects
  const projects = byType('project')
  if (projects.length) {
    sections.push('\n## Projects\n')
    for (const p of projects) {
      const fm = p.frontmatter
      sections.push(
        `### ${fm.name}` +
        (fm.status !== 'active' ? ` (${fm.status})` : '') +
        (p.body ? `\n${p.body}` : '') +
        (Array.isArray(fm.highlights) && fm.highlights.length
          ? '\n**Highlights:**\n' + fm.highlights.map((h: string) => `- ${h}`).join('\n')
          : '')
      )
    }
  }

  // Education
  const educations = byType('education')
  if (educations.length) {
    sections.push('\n## Education\n')
    for (const e of educations) {
      const fm = e.frontmatter
      sections.push(
        `### ${fm.qualification}${fm.field ? ` in ${fm.field}` : ''} — ${fm.institution}` +
        (fm.grade ? ` (${fm.grade})` : '') +
        (e.body ? `\n${e.body}` : '')
      )
    }
  }

  // Certifications
  const certs = byType('certification')
  if (certs.length) {
    sections.push('\n## Certifications\n')
    for (const c of certs) {
      const fm = c.frontmatter
      sections.push(`### ${fm.name} — ${fm.issuer} (${fm.issueDate})`)
    }
  }

  return sections.join('\n')
}

// ------------------------------------------------------------
// Error types
// ------------------------------------------------------------

export class VaultParseError extends Error {
  constructor(message: string, public filePath: string) {
    super(`VaultParseError [${filePath}]: ${message}`)
    this.name = 'VaultParseError'
  }
}
