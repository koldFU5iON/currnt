'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateNameAction } from '../_actions'

interface Props {
  initialName: string
}

export function ProfileSection({ initialName }: Props) {
  const [name, setName] = useState(initialName)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.trim() === initialName) return
    startTransition(async () => {
      const result = await updateNameAction(name.trim())
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Name updated.')
      }
    })
  }

  return (
    <section>
      <h2 className="text-sm font-semibold mb-4">Profile</h2>
      <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="display-name">Display name</Label>
          <Input
            id="display-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            disabled={isPending}
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !name.trim() || name.trim() === initialName}
        >
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </form>
    </section>
  )
}
