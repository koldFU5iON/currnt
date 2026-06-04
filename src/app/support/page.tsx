import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { PublicNav } from '@/components/public-nav'
import { Support } from '@/components/support'

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
      <Support />
      <footer className="border-t border-border px-8 py-5">
        <p className="text-xs text-muted-foreground">Built to help people find work.</p>
      </footer>
    </div>
  )
}
