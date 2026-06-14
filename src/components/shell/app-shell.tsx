"use client"

import React from "react"
import { CommandBar } from "./command-bar"
import { AppFooter } from "./app-footer"
import { AlphaBanner } from "./alpha-banner"
import { ChatPanel } from "./chat-panel"
import { usePageContext } from "@/lib/context/page-context"

type ErrorBoundaryState = { error: boolean }

class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: false }
  }

  static getDerivedStateFromError() {
    return { error: true }
  }

  render() {
    if (this.state.error) {
      return (
        <aside className="flex h-full w-full flex-col border-l bg-background fixed inset-y-0 right-0 z-40 max-w-sm shadow-lg md:static md:z-auto md:w-[28rem] md:max-w-none md:shadow-none lg:w-[36rem] xl:w-[44rem]">
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">The assistant encountered an error.</p>
            <button
              className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
              onClick={() => this.setState({ error: false })}
            >
              Try again
            </button>
          </div>
        </aside>
      )
    }
    return this.props.children
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { chatOpen, togglePanel, closePanel } = usePageContext()

  return (
    <div className="flex h-svh w-full overflow-hidden print:h-auto print:overflow-visible print:block">
      {/* Center column: command bar / main content / footer */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CommandBar
          chatOpen={chatOpen}
          onToggleChat={togglePanel}
        />
        <AlphaBanner />
        <div className="flex min-h-0 flex-1 flex-col overflow-auto print:overflow-visible print:h-auto">{children}</div>
        <AppFooter />
      </div>

      {/* Full-height right panel reserved for the assistant */}
      <ChatErrorBoundary>
        <ChatPanel open={chatOpen} onClose={closePanel} />
      </ChatErrorBoundary>
    </div>
  )
}
