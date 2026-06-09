'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isTextUIPart } from 'ai'
import { Sparkles, X, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePageContext } from '@/lib/context/page-context'
import { getChatSettings, saveChatModel } from '@/modules/llm/actions'
import { ChatMessage } from './chat-message'
import { toast } from 'sonner'

type ChatSettings = {
  chatModel: string | null
  llmModel: string
  availableModels: { id: string; name: string }[] | null
  configured: boolean
}

const IDLE_TIMEOUT_MS = 10 * 60 * 1000

type ChatPanelProps = {
  open: boolean
  onClose: () => void
}

export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const { context } = usePageContext()
  const [settings, setSettings] = useState<ChatSettings | null>(null)
  const [input, setInput] = useState('')
  const [modelSaving, startModelSave] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { messages, sendMessage, status, addToolOutput, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat/stream',
      body: { pageContext: context },
    }),
    onError: () => toast.error('Something went wrong. Try again.'),
  })

  useEffect(() => {
    if (open && !settings) {
      getChatSettings().then(setSettings).catch(() => {})
    }
  }, [open, settings])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function resetIdleTimer() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      triggerSummarize()
    }, IDLE_TIMEOUT_MS)
  }

  function triggerSummarize() {
    if (messages.length < 2) return
    const body = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.parts?.find(p => isTextUIPart(p))?.text ?? '',
      }))
      .filter(m => m.content)
    if (body.length < 2) return
    fetch('/api/chat/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: body }),
    }).catch(() => {})
    setMessages([])
  }

  function handleClose() {
    triggerSummarize()
    onClose()
  }

  function handleModelChange(model: string | null) {
    if (!model || !settings) return
    setSettings(prev => (prev ? { ...prev, chatModel: model } : prev))
    startModelSave(async () => {
      try {
        await saveChatModel(model)
      } catch {
        toast.error('Failed to save model preference')
      }
    })
  }

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || status === 'streaming' || status === 'submitted') return
    setInput('')
    resetIdleTimer()
    sendMessage({ text: trimmed })
  }

  const isLoading = status === 'streaming' || status === 'submitted'
  const activeModel = settings?.chatModel ?? settings?.llmModel ?? ''
  const modelOptions = settings?.availableModels ?? []

  if (!open) return null

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-l bg-background',
        'fixed inset-y-0 right-0 z-40 max-w-sm shadow-lg md:static md:z-auto md:w-[22rem] md:max-w-none md:shadow-none lg:w-[26rem]',
      )}
      aria-label="Career coach assistant"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-muted-foreground" />
          Career Coach
        </div>
        <div className="flex items-center gap-2">
          {modelOptions.length > 0 && (
            <Select
              value={activeModel}
              onValueChange={handleModelChange}
              disabled={modelSaving}
            >
              <SelectTrigger className="h-7 w-40 text-xs">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map(m => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleClose}
            aria-label="Close assistant"
          >
            <X />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Sparkles className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              {settings?.configured === false
                ? 'Set up your API key to get started'
                : "I'm your career coach"}
            </p>
            <p className="max-w-[14rem] text-xs text-muted-foreground">
              {settings?.configured === false
                ? 'Go to Settings → LLM to add your key.'
                : 'Ask me anything about your profile, applications, or interview prep.'}
            </p>
          </div>
        ) : (
          messages.map(m => (
            <ChatMessage
              key={m.id}
              message={m}
              onToolOutput={(toolCallId, toolName, output) =>
                addToolOutput({
                  toolCallId,
                  output: output as never,
                  tool: toolName as never,
                })
              }
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask your coach…"
            className="min-h-[40px] max-h-32 resize-none text-sm"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={isLoading || !input.trim() || settings?.configured === false}
            className="shrink-0"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
