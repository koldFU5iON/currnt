'use client'

import { isTextUIPart, isToolUIPart, getToolName, type UIMessage } from 'ai'
import { Bot, User, Loader2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolConfirmationCard } from './tool-confirmation-card'

type ChatMessageProps = {
  message: UIMessage
  onToolOutput: (toolCallId: string, toolName: string, output: unknown) => void
}

export function ChatMessage({ message, onToolOutput }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-2.5 px-4 py-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      <div className={cn('flex max-w-[85%] flex-col gap-2', isUser && 'items-end')}>
        {message.parts?.map((part, i) => {
          if (isTextUIPart(part)) {
            return (
              <p
                key={i}
                className={cn(
                  'rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                  isUser
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground',
                )}
              >
                {part.text}
              </p>
            )
          }

          if (isToolUIPart(part)) {
            const toolName = getToolName(part)
            const isWriteTool = toolName.startsWith('propose_')
            const { state } = part

            if (state === 'input-available' && isWriteTool) {
              return (
                <ToolConfirmationCard
                  key={part.toolCallId}
                  toolName={toolName}
                  args={part.input as Record<string, unknown>}
                  onAccept={() => onToolOutput(part.toolCallId, toolName, { status: 'accepted' })}
                  onReject={() => onToolOutput(part.toolCallId, toolName, { status: 'rejected' })}
                />
              )
            }

            if ((state === 'input-available' || state === 'input-streaming') && !isWriteTool) {
              return (
                <div
                  key={part.toolCallId}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Loader2 className="size-3 animate-spin" />
                  Looking up {toolName.replace(/_/g, ' ')}…
                </div>
              )
            }

            if (state === 'output-available' && isWriteTool) {
              const output = part.output as { status: string } | null
              return (
                <div
                  key={part.toolCallId}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <ChevronRight className="size-3" />
                  {output?.status === 'accepted' ? 'Change applied' : 'Change declined'}
                </div>
              )
            }

            return null
          }

          return null
        })}
      </div>
    </div>
  )
}
