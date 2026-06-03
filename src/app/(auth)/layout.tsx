import { Logo } from "@/components/brand/logo"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Logo variant="stacked" size="lg" />
        </div>
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  )
}
