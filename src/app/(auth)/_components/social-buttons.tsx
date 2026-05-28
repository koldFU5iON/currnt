'use client'

import { useState } from "react"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import type { EnabledSocialProvider } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const PROVIDER_LABEL: Record<EnabledSocialProvider, string> = {
  google: "Continue with Google",
  linkedin: "Continue with LinkedIn",
  twitter: "Continue with X",
}

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect width="16" height="16" rx="3" fill="#0A66C2" />
      <path
        d="M3.5 6h1.8v5.5H3.5V6zm.9-2.8a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zM6.8 6h1.7v.75h.02c.24-.45.82-.93 1.68-.93 1.8 0 2.13 1.18 2.13 2.72v3.06H10.6V8.87c0-.6-.01-1.38-.84-1.38-.84 0-.97.66-.97 1.34v2.77H6.8V6z"
        fill="white"
      />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M15.68 8.18c0-.57-.05-1.12-.14-1.64H8v3.1h4.3a3.67 3.67 0 0 1-1.59 2.41v2h2.57c1.5-1.38 2.4-3.42 2.4-5.87z" fill="#4285F4" />
      <path d="M8 16c2.16 0 3.97-.72 5.29-1.94l-2.57-2a4.8 4.8 0 0 1-2.72.75c-2.09 0-3.86-1.41-4.49-3.31H.86v2.06A8 8 0 0 0 8 16z" fill="#34A853" />
      <path d="M3.51 9.5A4.83 4.83 0 0 1 3.26 8c0-.52.09-1.03.25-1.5V4.44H.86A8 8 0 0 0 0 8c0 1.29.31 2.51.86 3.56L3.51 9.5z" fill="#FBBC05" />
      <path d="M8 3.19c1.18 0 2.23.4 3.06 1.2l2.29-2.29C11.97.72 10.16 0 8 0A8 8 0 0 0 .86 4.44L3.51 6.5C4.14 4.6 5.91 3.19 8 3.19z" fill="#EA4335" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.16 6.77 14.38 0h-1.24L8.6 5.88 4.8 0H.53l5.48 7.98L.53 15.27h1.24l4.79-5.57 3.83 5.57H14.6L9.16 6.77zm-1.7 1.97-.55-.79L2.2 1H4.2l3.56 5.09.56.79 4.62 6.6H10.9L7.46 8.74z" fill="currentColor" />
    </svg>
  )
}

const PROVIDER_ICON: Record<EnabledSocialProvider, React.ReactNode> = {
  google: <GoogleIcon />,
  linkedin: <LinkedInIcon />,
  twitter: <XIcon />,
}

type Props = {
  providers: EnabledSocialProvider[]
  callbackUrl: string
}

export function SocialButtons({ providers, callbackUrl }: Props) {
  const [pending, setPending] = useState<EnabledSocialProvider | null>(null)

  if (providers.length === 0) {
    return null
  }

  const handleClick = async (provider: EnabledSocialProvider) => {
    setPending(provider)
    try {
      await authClient.signIn.social({ provider, callbackURL: callbackUrl })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Sign in with ${provider} failed`
      toast.error(message)
      setPending(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>
      <div className="space-y-2">
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => handleClick(provider)}
            disabled={pending !== null}
          >
            {pending === provider ? (
              "Redirecting..."
            ) : (
              <>
                {PROVIDER_ICON[provider]}
                {PROVIDER_LABEL[provider]}
              </>
            )}
          </Button>
        ))}
      </div>
    </div>
  )
}
