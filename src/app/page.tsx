import Link from 'next/link'
import { Key, Check } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { getSession } from '@/lib/session'
import { CloneSnippet } from './_components/CloneSnippet'
import { brand } from '@/lib/brand'
import { Wordmark } from '@/components/brand/wordmark'
import { FeatureSection } from './_components/feature-section'

function GitHubIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

const GITHUB_URL = 'https://github.com/koldFU5iON/resume'
const CLONE_URL = 'https://github.com/koldFU5iON/resume.git'

const TRUST_PILLS = [
  { icon: GitHubIcon, label: 'Open source' },
  { icon: Key, label: 'Bring your own AI key' },
  { icon: Check, label: 'No job board' },
] as const


export default async function Home() {
  let isAuthenticated = false
  try {
    const session = await getSession()
    isAuthenticated = !!session
  } catch {
    // unauthenticated visitor
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-border px-8 py-4">
        <Wordmark size="md" />
        {isAuthenticated ? (
          <Link href="/dashboard" className={buttonVariants({ size: 'sm' })}>
            Go to dashboard &rarr;
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              <GitHubIcon size={15} />
              Open source
            </a>
            <Link
              href="/sign-in"
              className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              Sign in
            </Link>
            <Link href="/sign-up" className={buttonVariants({ size: 'sm' })}>
              Get started
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <div className="mx-auto max-w-2xl px-8 pb-10 pt-20 text-center">
        <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {brand.hero.eyebrow}
        </p>
        <h1 className="mb-5 text-5xl font-bold leading-tight tracking-tight">
          {brand.hero.title}
        </h1>
        <p className="mx-auto mb-7 max-w-lg text-lg leading-relaxed text-muted-foreground">
          {brand.hero.body}
        </p>

        {/* Trust pills */}
        <div className="mb-7 flex flex-wrap justify-center gap-2">
          {TRUST_PILLS.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
            >
              <Icon size={11} />
              {label}
            </span>
          ))}
        </div>

        {/* CTA */}
        {isAuthenticated ? (
          <Link href="/dashboard" className={buttonVariants({ size: 'lg' })}>
            Go to dashboard &rarr;
          </Link>
        ) : (
          <div className="flex flex-col items-center gap-3.5">
            <Link href="/sign-up" className={buttonVariants({ size: 'lg' })}>
              Get started for free
            </Link>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/sign-in"
                className="underline transition-colors duration-150 hover:text-foreground"
              >
                Sign in
              </Link>
            </p>

            <div className="my-1 flex w-full max-w-xs items-center gap-3">
              <hr className="flex-1 border-border" />
              <span className="text-xs text-muted-foreground">or run it yourself</span>
              <hr className="flex-1 border-border" />
            </div>

            <div className="w-full max-w-sm">
              <CloneSnippet repo={CLONE_URL} />
            </div>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              View on GitHub &rarr;
            </a>
          </div>
        )}
      </div>

      {/* LLM note */}
      {!isAuthenticated && (
        <div className="mx-auto max-w-xl px-8 pb-10 text-center">
          <p className="border-t border-border pt-6 text-sm italic text-muted-foreground">
            Already using ChatGPT or Claude in your job search? Plug in your own API key. The
            AI runs on your account, not ours.
          </p>
        </div>
      )}

      {/* Feature section */}
      <FeatureSection />

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-border px-8 py-5">
        <p className="text-xs text-muted-foreground">Built to help people find work.</p>
        {isAuthenticated ? (
          <Link
            href="/dashboard"
            className="text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Go to dashboard &rarr;
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">
            <Link
              href="/sign-in"
              className="underline transition-colors duration-150 hover:text-foreground"
            >
              Sign in
            </Link>
            {' · '}
            <Link
              href="/sign-up"
              className="underline transition-colors duration-150 hover:text-foreground"
            >
              Get started
            </Link>
          </p>
        )}
      </footer>
    </div>
  )
}
