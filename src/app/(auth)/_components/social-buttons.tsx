'use client'

import { useState } from "react"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import type { EnabledSocialProvider } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { LinkedInIcon, GoogleIcon, XIcon } from "@/components/provider-icons"

const PROVIDER_LABEL: Record<EnabledSocialProvider, string> = {
  google: "Continue with Google",
  linkedin: "Continue with LinkedIn",
  twitter: "Continue with X",
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
