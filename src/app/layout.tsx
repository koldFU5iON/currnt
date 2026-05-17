import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Fira_Code } from 'next/font/google'
import './globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'] })
const firaCode = Fira_Code({ variable: '--font-fira-code', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Resume',
  description: 'CV builder and job tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${firaCode.variable}`}>
      <body className="antialiased">
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  )
}
