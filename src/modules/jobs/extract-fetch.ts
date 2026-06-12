import { lookup as dnsLookup } from 'dns/promises'
import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'

export type FetchResult =
  | { ok: true; html: string; via: 'raw' | 'puppeteer' }
  | { ok: false; error: string }

// ── SSRF guard ────────────────────────────────────────────────────────────────

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const h = ip.toLowerCase()
    return (
      h === '::1' || h === '::' ||
      h.startsWith('fc') || h.startsWith('fd') ||
      h.startsWith('fe80') ||
      h.startsWith('::ffff:127.') ||
      h.startsWith('::ffff:10.') ||
      h.startsWith('::ffff:192.168.') ||
      /^::ffff:172\.(1[6-9]|2[0-9]|3[01])\./.test(h)
    )
  }
  return (
    ip === '0.0.0.0' ||
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip) ||
    /^169\.254\./.test(ip)
  )
}

function isSafeHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  const bare = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h
  if (bare.includes(':')) return !isPrivateIp(bare)
  return !(
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h === 'metadata.google.internal' ||
    isPrivateIp(h)
  )
}

export async function isSafeUrl(raw: string): Promise<boolean> {
  let parsed: URL
  try { parsed = new URL(raw) } catch { return false }
  if (parsed.protocol !== 'https:') return false
  if (!isSafeHostname(parsed.hostname)) return false
  try {
    const addrs = await dnsLookup(parsed.hostname, { all: true })
    return !addrs.some(a => isPrivateIp(a.address))
  } catch {
    return false
  }
}

// ── SPA detection ─────────────────────────────────────────────────────────────

const NOISE_TAGS_RE = /<(script|style|noscript|nav|header|footer|aside|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi
const ALL_TAGS_RE = /<[^>]+>/g

export function looksLikeSpa(html: string): boolean {
  const text = html
    .replace(NOISE_TAGS_RE, '')
    .replace(ALL_TAGS_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length < 500
}

// ── Puppeteer ─────────────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

async function getChromiumPath(): Promise<string> {
  if (process.env.CHROMIUM_EXECUTABLE_PATH) {
    return process.env.CHROMIUM_EXECUTABLE_PATH
  }
  if (process.env.NODE_ENV === 'development') {
    const { executablePath } = await import('puppeteer')
    return executablePath()
  }
  return chromium.executablePath(
    process.env.CHROMIUM_PACK_URL ??
    'https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar'
  )
}

async function renderWithPuppeteer(url: string): Promise<string> {
  const executablePath = await getChromiumPath()
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 800 },
    executablePath,
    headless: 'shell' as const,
  })
  try {
    const page = await browser.newPage()
    await page.setRequestInterception(true)
    page.on('request', async (req) => {
      const reqUrl = req.url()
      if (!reqUrl.startsWith('http://') && !reqUrl.startsWith('https://')) {
        req.abort()
        return
      }
      try {
        const safe = await isSafeUrl(reqUrl)
        if (!safe) { req.abort(); return }
      } catch { req.abort(); return }
      req.continue()
    })
    await page.setUserAgent(UA)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20_000 })
    return await page.content()
  } finally {
    await browser.close()
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const FETCH_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
}

export async function fetchPageContent(url: string): Promise<FetchResult> {
  if (!(await isSafeUrl(url))) {
    return { ok: false, error: 'Invalid URL — only public HTTPS job pages are supported.' }
  }
  let html: string
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(12_000),
    })
    if (res.url && res.url !== url) {
      if (!(await isSafeUrl(res.url))) {
        return { ok: false, error: 'Invalid URL — only public HTTPS job pages are supported.' }
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        error: `Could not reach that page — it may block automated access (${res.status}). Try pasting the details manually.`,
      }
    }
    html = await res.text()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: `Could not reach that URL: ${msg}` }
  }

  if (!looksLikeSpa(html)) {
    return { ok: true, html, via: 'raw' }
  }

  try {
    const rendered = await renderWithPuppeteer(url)
    return { ok: true, html: rendered, via: 'puppeteer' }
  } catch {
    return { ok: true, html, via: 'raw' }
  }
}
