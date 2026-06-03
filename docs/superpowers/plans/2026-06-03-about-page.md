# About Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public `/about` page with a narrative arc about currnt's "why," wire it into the landing page nav and dashboard, and extract the public nav into a shared component to avoid duplication.

**Architecture:** The about page is a public server component using the same unauthenticated shell pattern as the landing page. All copy lives in `brand.ts`. The public nav is extracted into `src/components/public-nav.tsx` (a server component that checks its own session) so both public pages share it. The four beliefs are a reusable `BeliefSection` component.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind CSS v4, shadcn/ui, `@/lib/brand.ts` for copy

---

### Task 1: Add about copy and GitHub URL to `brand.ts`

**Files:**
- Modify: `src/lib/brand.ts`

- [ ] **Step 1: Open `src/lib/brand.ts` and replace the entire file contents with the following**

```ts
const name = "currnt"
const tagline = "Stay current."
const githubUrl = "https://github.com/koldFU5iON/resume"

export const brand = {
  name,
  tagline,
  githubUrl,
  metaDescription: `${name} keeps a structured record of your career and shapes it to fit each role you go after. Open source, bring your own AI key.`,
  hero: {
    eyebrow: tagline,
    title: "Everything you've done, ready for what's next.",
    body: `${name} keeps a structured record of your career and shapes it to fit each role you go after. No job board. No templates. Just your work, presented clearly.`,
  },
  features: [
    {
      pillar: "Structured",
      title: "Structured, not templated",
      description:
        "Capture everything you've done as structured data: roles, skills, wins, without forcing your career into someone else's template.",
    },
    {
      pillar: "Adaptive",
      title: "Adapt to every role",
      description:
        "See how you fit an opportunity, then tailor what you present so each application reflects what that employer needs to see.",
    },
    {
      pillar: "Current",
      title: "Keep your search current",
      description:
        "Track every role you're chasing and keep your record up to date, so you're ready the moment something lands.",
    },
  ],
  about: {
    opening: {
      line1: "AI is reshaping every industry.",
      line2: "Somewhere in the rush, your career became something that happens to you — not something you own.",
    },
    moment:
      "Hiring is faster, noisier, and more competitive than it has ever been. AI is compressing timelines, automating screening, and making it harder to stand out with a static document. Most people are being evaluated before they have had a chance to show what they actually bring.",
    response:
      "currnt is built on a different premise: AI should be a companion in your career, not a replacement for your judgment. The goal is not to automate your identity — it is to surface what is already there and help you communicate it with precision. You bring your experience. currnt helps you show the critical impact behind it.",
    philosophy: {
      body: "Modern careers are no longer ladders. They are currents — they shift, adapt, accelerate, slow down, branch, and evolve. The professionals who thrive are not always the strongest or most experienced. They are the most adaptable.",
      missingE:
        "The name reflects this. currnt. The missing E is deliberate. Every person arrives with something they are pursuing: a new role, a new skill, a new direction. The missing letter represents that potential. Your story is still being written.",
    },
    beliefs: [
      {
        label: "Adaptive",
        body: "Modern professionals are multidimensional. You work across operations, communication, product, strategy, and creative — sometimes all at once. currnt reflects that reality rather than forcing your career into someone else's template.",
      },
      {
        label: "Structured",
        body: "People forget their own value. currnt turns fragmented experience into organised achievements, reusable evidence, and a structured career memory you can draw from at any time.",
      },
      {
        label: "Current",
        body: "Careers evolve constantly. currnt is built to move with you — capturing new experience as it happens and keeping your record relevant so you are ready when the right opportunity arrives.",
      },
      {
        label: "User-Owned",
        body: "Your professional identity belongs to you. currnt is open source. You bring your own AI key, choose your workflows, and control your data. The intelligence runs on your account, not ours.",
      },
    ],
    openSource:
      "You are not feeding your career into a black box. currnt is open source, auditable, and bring-your-own-key. The AI runs on your account. You see everything it does. You approve everything it outputs.",
    cta: {
      heading: "Take control of your career narrative.",
      primary: { label: "Get started free", href: "/sign-up" },
      secondary: { label: "View on GitHub", href: githubUrl },
    },
  },
} as const
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/brand.ts
git commit -m "feat(brand): add about copy and githubUrl to brand.ts"
```

---

### Task 2: Extract shared `PublicNav` component

Both the landing page and the about page need the same nav. Extract it now so neither page duplicates it.

**Files:**
- Create: `src/components/public-nav.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `src/components/public-nav.tsx`**

```tsx
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Logo } from '@/components/brand/logo'
import { brand } from '@/lib/brand'
import { getSession } from '@/lib/session'

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

export async function PublicNav() {
  let isAuthenticated = false
  try {
    const session = await getSession()
    isAuthenticated = !!session
  } catch {
    // unauthenticated visitor
  }

  return (
    <nav className="flex items-center justify-between border-b border-border px-8 py-4">
      <Link href="/">
        <Logo variant="line" size="md" />
      </Link>
      {isAuthenticated ? (
        <Link href="/dashboard" className={buttonVariants({ size: 'sm' })}>
          Go to dashboard &rarr;
        </Link>
      ) : (
        <div className="flex items-center gap-3">
          <a
            href={brand.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <GitHubIcon size={15} />
            Open source
          </a>
          <Link
            href="/about"
            className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            About
          </Link>
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
  )
}
```

- [ ] **Step 2: Update `src/app/page.tsx` to use `PublicNav`**

Replace the entire file with the following (removes the inline nav and `GitHubIcon` function, switches `GITHUB_URL` to `brand.githubUrl`):

```tsx
import Link from 'next/link'
import { Key, Check } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { getSession } from '@/lib/session'
import { CloneSnippet } from './_components/CloneSnippet'
import { brand } from '@/lib/brand'
import { PublicNav } from '@/components/public-nav'
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
      <PublicNav />

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
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Verify in browser**

Open `http://localhost:3000`. The landing page nav should look identical to before but now include an "About" link between "Open source" and "Sign in". Clicking the logo should navigate to `/` (home).

- [ ] **Step 5: Commit**

```bash
git add src/components/public-nav.tsx src/app/page.tsx
git commit -m "feat(nav): extract PublicNav component, add About link"
```

---

### Task 3: Build `BeliefSection` component

**Files:**
- Create: `src/app/about/_components/BeliefSection.tsx`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p src/app/about/_components
```

Then create `src/app/about/_components/BeliefSection.tsx`:

```tsx
import { brand } from "@/lib/brand"

type Belief = (typeof brand.about.beliefs)[number]

export function BeliefSection({ belief }: { belief: Belief }) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
        — {belief.label}
      </p>
      <p className="text-base leading-relaxed text-muted-foreground">
        {belief.body}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/about/_components/BeliefSection.tsx
git commit -m "feat(about): add BeliefSection component"
```

---

### Task 4: Build the about page

**Files:**
- Create: `src/app/about/page.tsx`

- [ ] **Step 1: Create `src/app/about/page.tsx`**

```tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import { buttonVariants } from '@/components/ui/button'
import { brand } from '@/lib/brand'
import { PublicNav } from '@/components/public-nav'
import { BeliefSection } from './_components/BeliefSection'

export const metadata: Metadata = {
  title: 'About',
  description: brand.metaDescription,
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />

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
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000/about`. Verify:
- Nav matches landing page nav (same links, logo links to `/`)
- Opening headline renders on two lines
- Each section has a monospace cyan label above it
- Four beliefs render with `— Label` monospace prefix
- CTA section has primary button + secondary GitHub link
- Thin `border-border/60` rules separate each section

- [ ] **Step 4: Commit**

```bash
git add src/app/about/page.tsx
git commit -m "feat(about): build about page with narrative arc layout"
```

---

### Task 5: Wire dashboard entry point

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add `Link` import and the "Why we built this" link to `src/app/dashboard/page.tsx`**

Add `Link` to the imports at the top:

```tsx
import Link from 'next/link'
import { redirect } from "next/navigation"
import { getOnboardingSettings } from "@/modules/onboarding/queries"
import { getDashboardStats } from "@/modules/jobs/queries"
import { StatsRow } from "./_components/StatsRow"
import { PipelineCard } from "./_components/PipelineCard"
import { NeedsAttentionCard } from "./_components/NeedsAttentionCard"
import { RecentActivityCard } from "./_components/RecentActivityCard"
```

Then add the link directly after the closing `/>` of `<StatsRow`:

```tsx
      <StatsRow
        totalActive={stats.totalActive}
        byStatus={stats.byStatus}
        lastActivity={stats.lastActivity}
      />
      <div className="-mt-2">
        <Link
          href="/about"
          className="text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          Why we built this &rarr;
        </Link>
      </div>
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000/dashboard`. Below the four stat cards you should see a small "Why we built this →" link. Clicking it should navigate to `/about`.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): add about page link below stats row"
```

---

### Task 6: Final check and push

- [ ] **Step 1: Full typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Smoke test the two entry points**

- `http://localhost:3000` — nav has "About" link, clicking it goes to `/about`
- `http://localhost:3000/about` — full page renders, "Get started free" goes to `/sign-up`, GitHub link opens in new tab
- `http://localhost:3000/dashboard` — "Why we built this →" visible below stats, links to `/about`

- [ ] **Step 4: Push**

```bash
git push
```
