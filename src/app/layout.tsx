import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Fira_Code } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'] })
const firaCode = Fira_Code({ variable: '--font-fira-code', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Job search operations',
  description:
    'Track applications, understand fit, and sharpen how you present yourself. Open source, bring your own AI key.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${firaCode.variable}`}>
      <body className="antialiased">

        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  )
}
