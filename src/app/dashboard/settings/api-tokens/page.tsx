import { listApiTokensAction } from '@/modules/api-tokens/actions'
import { ContentContainer } from '@/app/components/ContentContainer'
import { TokensManager } from './_components/tokens-manager'

export default async function Page() {
  const tokens = await listApiTokensAction()

  return (
    <ContentContainer
      title="Settings"
      description="Manage how external tools and agents talk to your account."
    >
      <TokensManager tokens={tokens} />
    </ContentContainer>
  )
}
