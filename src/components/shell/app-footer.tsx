"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MessageSquareWarning, Settings } from "lucide-react"

import { APP_VERSION } from "@/lib/version"
import { FeedbackDrawer } from "@/app/components/FeedbackDrawer"
import { formatTokens } from "@/modules/llm/format"

export function AppFooter() {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [tokens, setTokens] = useState<{ today: number; thisMonth: number } | null>(null)

  useEffect(() => {
    fetch('/api/usage/summary', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setTokens(data) })
      .catch(() => {})
  }, [])

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between gap-4 border-t bg-background px-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          <span>Ready</span>
        </div>
        {tokens !== null && (
          <span className="tabular-nums text-muted-foreground/60">
            {formatTokens(tokens.today)} today · {formatTokens(tokens.thisMonth)} mo
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <Settings className="size-3.5" />
          <span className="hidden sm:inline">Settings</span>
        </Link>
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <MessageSquareWarning className="size-3.5" />
          <span className="hidden sm:inline">Report an issue</span>
        </button>
        <span className="font-mono tabular-nums">v{APP_VERSION}</span>
      </div>

      <FeedbackDrawer open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </footer>
  )
}
