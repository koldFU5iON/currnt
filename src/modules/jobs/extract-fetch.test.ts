import { describe, it, expect } from 'vitest'
import { looksLikeSpa } from './extract-fetch'

describe('looksLikeSpa', () => {
  it('returns true for a React SPA shell with empty body', () => {
    const html = `
      <html>
        <head><script>/* bundled JS */</script><style>body{margin:0}</style></head>
        <body><div id="root"></div></body>
      </html>
    `
    expect(looksLikeSpa(html)).toBe(true)
  })

  it('returns true when only nav/footer content is present', () => {
    const html = `
      <html><body>
        <nav>Home About Jobs Contact</nav>
        <div id="app"></div>
        <footer>© 2024 Company Inc</footer>
      </body></html>
    `
    expect(looksLikeSpa(html)).toBe(true)
  })

  it('returns false for a content-rich job posting page', () => {
    const html = `
      <html><body><main>
        <h1>Senior Software Engineer at Acme</h1>
        <p>We are looking for a talented senior software engineer to join our growing team.
           You will work on challenging distributed systems problems and collaborate with
           passionate engineers committed to building excellent products users rely on daily.</p>
        <h2>Requirements</h2>
        <ul>
          <li>5+ years of software engineering experience with strong TypeScript skills</li>
          <li>Experience building and scaling distributed systems in production environments</li>
          <li>Strong understanding of data structures, algorithms, and system design principles</li>
        </ul>
      </main></body></html>
    `
    expect(looksLikeSpa(html)).toBe(false)
  })
})
