import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { brand } from "@/lib/brand"
import { cn } from "@/lib/utils"

export function Support({ className }: { className?: string }) {
  return (
    <article
      className={cn(
        "mx-auto max-w-4xl space-y-10 px-6 py-12 sm:px-8 sm:py-16",
        className
      )}
    >
      <SupportHero />

      <SupportPromiseGrid />

      <SupportFuture />

      <SupportKoFi />

      <SupportGitHub />
    </article>
  )
}

interface SupportingBlockProps {
  className?: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
      {children}
    </p>
  )
}

function SupportHero({ className }: SupportingBlockProps) {
  return (
    <header className={cn("space-y-4 border-b border-border/60 pb-8", className)}>
      <SectionLabel>Support currnt</SectionLabel>

      <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        Open source. Bring your own key. No weird surprises.
      </h1>

      <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
        currnt is built to help people understand their experience, shape stronger
        applications, and move through the job search with a little more clarity.
        The code is open. The hosted version is free. That is intentional.
      </p>
    </header>
  )
}

function SupportPromiseGrid({ className }: SupportingBlockProps) {
  return (
    <section className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <SupportPromiseCard
        title="Open source, always"
        body="The full codebase is on GitHub. Clone it, self-host it, fork it, break it, improve it. The hosted version exists for convenience, not lock-in."
      />

      <SupportPromiseCard
        title="You bring the key"
        body="currnt uses AI, but it does not hide that cost inside the product. You bring your own API key, which means you stay in control of usage and spend."
      />
    </section>
  )
}

function SupportPromiseCard({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <section className="rounded-xl border border-border bg-muted/20 p-5 space-y-2">
      <SectionLabel>{title}</SectionLabel>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </section>
  )
}

function SupportFuture({ className }: SupportingBlockProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/70 bg-background/40 p-6 space-y-3",
        className
      )}
    >
      <SectionLabel>Founder access</SectionLabel>

      <h2 className="text-xl font-semibold tracking-tight">
        Early users help shape what currnt becomes.
      </h2>

      <p className="text-sm leading-relaxed text-muted-foreground">
        If a paid tier ever exists, it will not suddenly lock away what you already
        have. No rug pulls. No surprise paywalls. The most likely future paid version
        would be additive: a hosted tier with AI bundled in, for people who do not
        want to manage their own API key.
      </p>
    </section>
  )
}

export function SupportKoFi({ className }: SupportingBlockProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-primary/30 bg-muted/30 p-6 sm:p-8 space-y-6",
        className
      )}
    >
      <div className="space-y-3">
        <p className="text-3xl">☕</p>

        <SectionLabel>Feed the abyss</SectionLabel>

        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight">
          currnt runs on caffeine, stubborn optimism, and Claude tokens.
        </h2>

        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Donations do not pay for your AI usage. You already bring your own API key
          for that. They help support the messy, useful, very human work behind the
          project: testing ideas, fixing bugs, writing docs, improving the experience,
          and building what comes next.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-background/50 p-5 space-y-4">
        <p className="text-sm font-medium">
          Mostly, donations fund the endless stream of questions I ask AI while building:
        </p>

        <ul className="space-y-2 text-sm italic leading-relaxed text-muted-foreground">
          <li>“Why is this broken?”</li>
          <li>“Why is this <span className="text-primary italic">still</span> broken?”</li>
          <li>“Why did fixing it create three new problems?”</li>
          <li>“Can we build something ridiculous and useful?”</li>
        </ul>

        <p className="text-sm leading-relaxed text-muted-foreground">
          If currnt has helped you move forward, feel free to throw a few tokens into
          the abyss.
        </p>

        <p className="text-sm font-medium">
          The abyss is surprisingly productive.{" "}
          <span className="italic text-muted-foreground">Most of the time.</span>
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href={brand.kofiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: "lg" })}
        >
          Support on Ko-fi
        </a>

        <p className="text-xs italic text-muted-foreground">
          No pressure. Seriously. But also: the tokens.
        </p>
      </div>
    </section>
  )
}

function SupportGitHub({ className }: SupportingBlockProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/70 bg-background/30 p-6 space-y-4",
        className
      )}
    >
      <div className="space-y-2">
        <SectionLabel>Other ways to help</SectionLabel>

        <p className="text-sm leading-relaxed text-muted-foreground">
          You do not have to donate to support currnt. Star the repo, share it with
          someone looking for work, open an issue, suggest an improvement, or submit
          a PR. All of it helps keep the current moving.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={brand.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          View on GitHub
        </a>

        <Link
          href="/about"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Read our story
        </Link>
      </div>
    </section>
  )
}
