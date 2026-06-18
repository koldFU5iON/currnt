import { Logo } from '@/components/brand/logo'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex justify-center">
          <Logo variant="stacked" size="lg" />
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}
