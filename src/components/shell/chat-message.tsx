'use client'

import { isTextUIPart, isToolUIPart, getToolName, type UIMessage } from 'ai'
import { Bot, User, Loader2, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { ToolConfirmationCard } from './tool-confirmation-card'
import { FeedbackSubmissionCard } from './feedback-submission-card'

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
              <div
                key={`text-${i}`}
                className={cn(
                  'rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                  isUser
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground',
                )}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="mb-1 ml-4 list-disc last:mb-0">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-1 ml-4 list-decimal last:mb-0">{children}</ol>,
                    li: ({ children }) => <li className="mb-0.5">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    code: ({ children }) => (
                      <code className="rounded bg-black/10 px-1 py-0.5 text-xs font-mono dark:bg-white/10">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="my-2 overflow-x-auto rounded-md bg-black/10 p-2 text-xs dark:bg-white/10">
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {part.text}
                </ReactMarkdown>
              </div>
            )
          }

          if (isToolUIPart(part)) {
            const toolName = getToolName(part)
            const isWriteTool = toolName.startsWith('propose_')
            const { state } = part

            if (state === 'input-available' && toolName === 'submit_feedback') {
              const input = part.input as { type: 'bug' | 'idea'; title: string; description: string }
              return (
                <FeedbackSubmissionCard
                  key={part.toolCallId}
                  toolCallId={part.toolCallId}
                  type={input.type}
                  title={input.title}
                  description={input.description}
                  onResult={(toolCallId, output) => onToolOutput(toolCallId, 'submit_feedback', output)}
                />
              )
            }

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

            if (state === 'output-available' && toolName === 'submit_feedback') {
              const output = part.output as { status: string } | null
              return (
                <div
                  key={part.toolCallId}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <ChevronRight className="size-3" />
                  {output?.status === 'submitted' ? 'Feedback submitted' : 'Feedback cancelled'}
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
                  {output?.status === 'accepted' ? 'Change accepted' : 'Change declined'}
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
