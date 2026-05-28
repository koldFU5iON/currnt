'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

type Props = { repo: string }

export function CloneSnippet({ repo }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(`git clone ${repo}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      console.warn('CloneSnippet: clipboard write failed')
    })
  }

  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-border bg-muted">
      <code className="flex-1 truncate px-4 py-2.5 font-mono text-sm text-foreground">
        git clone {repo}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="flex cursor-pointer items-center gap-1.5 border-l border-border bg-muted px-4 py-2.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
        aria-label="Copy clone command"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}
