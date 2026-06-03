import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Logo } from '@/components/brand/logo'
import { brand } from '@/lib/brand'
import { GitHubIcon } from '@/components/icons/github-icon'

export function PublicNav({ isAuthenticated }: { isAuthenticated: boolean }) {
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
