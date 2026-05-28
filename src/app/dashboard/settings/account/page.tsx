import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { requireProfile } from '@/lib/session'
import { getEnabledSocialProviders } from '@/lib/auth'
import { ContentContainer } from '@/app/components/ContentContainer'
import { ProfileSection } from './_components/profile-section'
import { PasswordSection } from './_components/password-section'
import { ConnectedAccountsSection } from './_components/connected-accounts-section'

export default async function Page() {
  const { session } = await requireProfile()
  const accounts = await auth.api.listUserAccounts({ headers: await headers() })
  const enabledProviders = getEnabledSocialProviders()

  const hasCredentialAccount = accounts.some(a => a.providerId === 'credential')

  return (
    <ContentContainer
      title="Account"
      description="Display name, password, and connected sign-in methods."
    >
      <div className="space-y-8">
        <ProfileSection initialName={session.user.name ?? ''} />
        <PasswordSection hasCredentialAccount={hasCredentialAccount} />
        <ConnectedAccountsSection
          initialAccounts={accounts.map(a => ({ providerId: a.providerId, accountId: a.accountId }))}
          enabledProviders={enabledProviders}
        />
      </div>
    </ContentContainer>
  )
}
