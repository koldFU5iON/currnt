import { listApiTokensAction } from '@/modules/api-tokens/actions'
import { ContentContainer } from '@/app/components/ContentContainer'
import { Separator } from '@/components/ui/separator'
import { TokensManager } from './_components/tokens-manager'
import { IntegrationsList } from './_components/integrations-list'

export default async function Page() {
  const tokens = await listApiTokensAction()

  return (
    <ContentContainer
      title="Settings"
      description="Manage how external tools and agents talk to your account."
    >
      <div className="space-y-10">
        <TokensManager tokens={tokens} />
        <Separator />
        <IntegrationsList />
      </div>
    </ContentContainer>
  )
}
