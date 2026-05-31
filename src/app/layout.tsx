import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Fira_Code } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import { brand } from '@/lib/brand'

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'] })
const firaCode = Fira_Code({ variable: '--font-fira-code', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.metaDescription,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${firaCode.variable}`}>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
