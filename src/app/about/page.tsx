import Link from 'next/link'
import type { Metadata } from 'next'
import { buttonVariants } from '@/components/ui/button'
import { brand } from '@/lib/brand'
import { getSession } from '@/lib/session'
import { PublicNav } from '@/components/public-nav'
import { BeliefSection } from './_components/BeliefSection'

export const metadata: Metadata = {
  title: 'About',
  description: brand.metaDescription,
}

export default async function AboutPage() {
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

      <article className="mx-auto max-w-2xl px-8 py-16 space-y-12">

        {/* Opening */}
        <header className="space-y-3">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            {brand.about.opening.line1}
            <br />
            {brand.about.opening.line2}
          </h1>
        </header>

        <hr className="border-border/60" />

        {/* The moment */}
        <section className="space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            The moment
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            {brand.about.moment}
          </p>
        </section>

        {/* The response */}
        <section className="space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            The response
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            {brand.about.response}
          </p>
        </section>

        <hr className="border-border/60" />

        {/* Philosophy */}
        <section className="space-y-4">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            The philosophy
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            {brand.about.philosophy.body}
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            {brand.about.philosophy.missingE}
          </p>
        </section>

        <hr className="border-border/60" />

        {/* Four beliefs */}
        <section className="space-y-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            What we believe
          </p>
          {brand.about.beliefs.map((belief) => (
            <BeliefSection key={belief.label} belief={belief} />
          ))}
        </section>

        <hr className="border-border/60" />

        {/* Open source */}
        <section className="space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            Open source
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            {brand.about.openSource}
          </p>
        </section>

        <hr className="border-border/60" />

        {/* CTA */}
        <section className="space-y-5 py-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            {brand.about.cta.heading}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={brand.about.cta.primary.href} className={buttonVariants({ size: 'lg' })}>
              {brand.about.cta.primary.label}
            </Link>
            <a
              href={brand.about.cta.secondary.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {brand.about.cta.secondary.label} &rarr;
            </a>
          </div>
        </section>

      </article>

      <footer className="border-t border-border px-8 py-5">
        <p className="text-xs text-muted-foreground">Built to help people find work.</p>
      </footer>
    </div>
  )
}
