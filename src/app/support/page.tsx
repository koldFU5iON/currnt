import Link from 'next/link'
import type { Metadata } from 'next'
import { buttonVariants } from '@/components/ui/button'
import { brand } from '@/lib/brand'
import { getSession } from '@/lib/session'
import { PublicNav } from '@/components/public-nav'

export const metadata: Metadata = {
  title: 'Support',
  description: `currnt is open source and free to self-host. Here's how the project stays alive and how you can help.`,
}

export default async function SupportPage() {
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
            How currnt stays alive.
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            The honest version of what this project is, how it runs, and what you can expect from it.
          </p>
        </header>

        <hr className="border-border/60" />

        {/* Open source */}
        <section className="space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            Open source, always
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            currnt is open source and always will be. The full codebase is on GitHub — free to clone,
            self-host, modify, and run on your own infrastructure with your own API keys. If the hosted
            version ever stopped existing, you could run your own tomorrow. That is the commitment.
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            The hosted version exists for convenience, not exclusivity.
          </p>
        </section>

        <hr className="border-border/60" />

        {/* Founder Access */}
        <section className="space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            Founder access
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            Right now, the hosted version is free. People using currnt during this early phase are
            Founder members — you are helping shape what this becomes, giving real feedback on real
            workflows, and building something together.
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            If a paid tier ever launches, Founder members will be the first to know, the last to be
            surprised, and the first in line for whatever recognition makes sense. No rug pulls.
            No sudden paywalls. That is not what this is.
          </p>
        </section>

        <hr className="border-border/60" />

        {/* Future */}
        <section className="space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            What comes next
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            At some point, hosting costs and ongoing development may require a premium tier. If that
            happens, it will be additive — new capabilities on top of what already exists, not a gate
            on what you have today. The self-hosted path stays free. The core stays open.
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            The most likely shape: a managed hosted tier that bundles the AI so you do not need your
            own API key. Everything else stays as it is.
          </p>
        </section>

        <hr className="border-border/60" />

        {/* Ko-fi — playful */}
        <section className="space-y-6">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            Feed the tokens
          </p>
          <div className="rounded-xl border border-border bg-muted/30 px-8 py-10 text-center space-y-4">
            <p className="text-2xl">☕</p>
            <p className="text-base font-medium leading-snug">
              currnt runs on Claude tokens.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground max-w-sm mx-auto">
              Job fits, profile summaries, CV parsing — it adds up. If currnt has helped you land an
              interview, write a sharper application, or just feel less like your career is a pile of
              scattered notes somewhere — consider buying one. Or ten. The tokens are hungry and the
              development never really stops.
            </p>
            <p className="text-xs text-muted-foreground italic">
              (No pressure. Seriously. But also: the tokens.)
            </p>
            <a
              href={brand.kofiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: 'lg' })}
            >
              Support on Ko-fi
            </a>
          </div>
        </section>

        <hr className="border-border/60" />

        {/* GitHub */}
        <section className="space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            Other ways to help
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            Star the repo, share it with someone who is job hunting, open an issue when something
            breaks, or submit a pull request if you have an idea. All of it matters and all of it
            is appreciated.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={brand.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              View on GitHub
            </a>
            <Link
              href="/about"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              Read our story
            </Link>
          </div>
        </section>

      </article>

      <footer className="border-t border-border px-8 py-5">
        <p className="text-xs text-muted-foreground">Built to help people find work.</p>
      </footer>
    </div>
  )
}
