import Link from 'next/link'
import { Key, Check } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { getSession } from '@/lib/session'
import { CloneSnippet } from './_components/CloneSnippet'
import { brand } from '@/lib/brand'
import { PublicNav } from '@/components/public-nav'
import { FeatureSection } from './_components/feature-section'
import { GitHubIcon } from '@/components/icons/github-icon'

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
      <PublicNav isAuthenticated={isAuthenticated} />

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
              <CloneSnippet repo={`${brand.githubUrl}.git`} />
            </div>
            <a
              href={brand.githubUrl}
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

      <FeatureSection />

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
