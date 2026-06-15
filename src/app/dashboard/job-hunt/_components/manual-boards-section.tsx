'use client'

import { useState, useTransition } from 'react'
import type { ManualJobBoard } from '@prisma/client'
import { ExternalLink, Plus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addManualBoard, removeManualBoard } from '@/modules/job-hunt/manual-boards/actions'

type Props = {
  boards: ManualJobBoard[]
}

function groupByCategory(boards: ManualJobBoard[]) {
  const map = new Map<string, ManualJobBoard[]>()
  for (const b of boards) {
    const existing = map.get(b.category)
    if (existing) existing.push(b)
    else map.set(b.category, [b])
  }
  return map
}

export function ManualBoardsSection({ boards }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [category, setCategory] = useState('')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [isPending, startTransition] = useTransition()

  const grouped = groupByCategory(boards)

  function handleAdd() {
    startTransition(async () => {
      const result = await addManualBoard({ category: category.trim(), name: name.trim(), url: url.trim() })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setCategory('')
      setName('')
      setUrl('')
      setShowForm(false)
    })
  }

  function handleRemove(id: string, boardName: string) {
    startTransition(async () => {
      const result = await removeManualBoard(id)
      if (!result.ok) toast.error('Could not remove board')
      else toast.success(`Removed ${boardName}`)
    })
  }

  return (
    <div className="rounded-lg border border-dashed px-3 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Manual boards
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="size-2.5" />
          Add
        </button>
      </div>

      {showForm && (
        <div className="space-y-1.5 pb-1">
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (e.g. Gaming)"
            className="h-6 text-xs"
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Hitmarker)"
            className="h-6 text-xs"
          />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (https://…)"
            className="h-6 text-xs"
          />
          <div className="flex gap-1.5 pt-0.5">
            <Button
              size="sm"
              className="h-6 px-2 text-xs flex-1"
              onClick={handleAdd}
              disabled={isPending || !category.trim() || !name.trim() || !url.trim()}
            >
              {isPending ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {boards.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground">No boards added yet</p>
      )}

      {[...grouped.entries()].map(([cat, items]) => (
        <div key={cat}>
          <p className="text-[10px] font-medium text-muted-foreground mb-1">{cat}</p>
          <div className="space-y-0.5">
            {items.map((board) => (
              <div key={board.id} className="flex items-center gap-1 group">
                <a
                  href={board.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-foreground hover:text-primary transition-colors flex-1 min-w-0"
                >
                  <span className="truncate">{board.name}</span>
                  <ExternalLink className="size-2.5 opacity-50 shrink-0" />
                </a>
                <button
                  onClick={() => handleRemove(board.id, board.name)}
                  disabled={isPending}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                  aria-label={`Remove ${board.name}`}
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
