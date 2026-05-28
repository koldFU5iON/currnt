'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { LinkedInIcon, GoogleIcon, XIcon } from '@/components/provider-icons'
import { unlinkAccountAction } from '../_actions'
import type { EnabledSocialProvider } from '@/lib/auth'

type Account = { providerId: string; accountId: string }

type ProviderMeta = {
  providerId: string
  label: string
  icon: React.ReactNode
}

const ALL_PROVIDERS: ProviderMeta[] = [
  { providerId: 'credential', label: 'Email / Password', icon: <KeyRound size={16} className="text-muted-foreground" /> },
  { providerId: 'linkedin',   label: 'LinkedIn',         icon: <LinkedInIcon /> },
  { providerId: 'google',     label: 'Google',           icon: <GoogleIcon /> },
  { providerId: 'twitter',    label: 'X',                icon: <XIcon /> },
]

interface Props {
  initialAccounts: Account[]
  enabledProviders: EnabledSocialProvider[]
}

export function ConnectedAccountsSection({ initialAccounts, enabledProviders }: Props) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [pending, startTransition] = useTransition()
  const [actionTarget, setActionTarget] = useState<string | null>(null)

  const isLinked = (providerId: string) =>
    accounts.some(a => a.providerId === providerId)

  const handleUnlink = (providerId: string) => {
    setActionTarget(providerId)
    startTransition(async () => {
      const result = await unlinkAccountAction(providerId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setAccounts(prev => prev.filter(a => a.providerId !== providerId))
        toast.success('Account unlinked.')
      }
      setActionTarget(null)
    })
  }

  const handleConnect = async (providerId: EnabledSocialProvider) => {
    setActionTarget(providerId)
    try {
      await authClient.signIn.social({
        provider: providerId,
        callbackURL: '/dashboard/settings/account',
      })
    } catch {
      toast.error(`Could not connect ${providerId}. Please try again.`)
      setActionTarget(null)
    }
  }

  const socialProviders = ALL_PROVIDERS.filter(p => p.providerId !== 'credential')
  const isSingleAccount = accounts.length === 1

  return (
    <section>
      <h2 className="text-sm font-semibold mb-4">Connected accounts</h2>
      <ul className="max-w-sm divide-y divide-border rounded-lg border border-border">
        {/* Credential row */}
        {(() => {
          const meta = ALL_PROVIDERS[0]
          const linked = isLinked('credential')
          if (!linked) return null
          return (
            <li key="credential" className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {meta.icon}
                <span className="text-sm truncate">{meta.label}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">Connected</span>
            </li>
          )
        })()}

        {/* Social provider rows */}
        {socialProviders.map(meta => {
          const linked = isLinked(meta.providerId)
          const enabled = enabledProviders.includes(meta.providerId as EnabledSocialProvider)
          const isActing = actionTarget === meta.providerId && pending

          return (
            <li key={meta.providerId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={linked || enabled ? '' : 'opacity-40'}>{meta.icon}</span>
                <span className={`text-sm truncate ${!linked && !enabled ? 'text-muted-foreground' : ''}`}>
                  {meta.label}
                </span>
              </div>
              {linked ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleUnlink(meta.providerId)}
                  disabled={pending || isSingleAccount}
                  title={isSingleAccount ? 'Cannot remove your only sign-in method' : undefined}
                >
                  {isActing ? 'Removing...' : 'Unlink'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handleConnect(meta.providerId as EnabledSocialProvider)}
                  disabled={!enabled || pending}
                  title={!enabled ? 'Not configured' : undefined}
                >
                  {isActing ? 'Connecting...' : 'Connect'}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {isSingleAccount && (
        <p className="mt-2 text-xs text-muted-foreground max-w-sm">
          Add another sign-in method before removing this one.
        </p>
      )}
    </section>
  )
}
