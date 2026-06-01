import { describe, it, expect } from 'vitest'
import { stripHtmlToText, ExtractedJobLLMSchema } from './extract-llm'

describe('stripHtmlToText', () => {
  it('removes script and style tags and their content', () => {
    const html = '<p>Job title</p><script>alert("xss")</script><style>.btn{}</style>'
    const result = stripHtmlToText(html)
    expect(result).toContain('Job title')
    expect(result).not.toContain('alert')
    expect(result).not.toContain('.btn')
  })

  it('removes nav, header, footer, aside elements', () => {
    const html = '<nav>Menu</nav><main><p>Description</p></main><footer>© 2024</footer>'
    const result = stripHtmlToText(html)
    expect(result).toContain('Description')
    expect(result).not.toContain('Menu')
    expect(result).not.toContain('© 2024')
  })

  it('strips remaining HTML tags', () => {
    const html = '<h1 class="title">Senior Engineer</h1><p>Build things.</p>'
    expect(stripHtmlToText(html)).toContain('Senior Engineer')
    expect(stripHtmlToText(html)).not.toContain('<h1')
  })

  it('truncates to 12000 characters', () => {
    const html = '<p>' + 'a'.repeat(20_000) + '</p>'
    expect(stripHtmlToText(html).length).toBeLessThanOrEqual(12_000)
  })

  it('decodes common HTML entities', () => {
    const html = '<p>Salary: $120k &amp; benefits</p>'
    expect(stripHtmlToText(html)).toContain('$120k & benefits')
  })
})

describe('ExtractedJobLLMSchema', () => {
  it('accepts a fully populated object', () => {
    const result = ExtractedJobLLMSchema.safeParse({
      title: 'Senior Engineer',
      company: 'Acme',
      location: 'Remote',
      jobDescription: 'Build things.',
      jobNumber: 'REQ-123',
      salaryBand: '$120k–$160k',
      datePublished: '2024-01-15',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an empty object (all fields optional)', () => {
    expect(ExtractedJobLLMSchema.safeParse({}).success).toBe(true)
  })
})
