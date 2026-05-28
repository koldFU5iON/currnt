'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changePasswordAction } from '../_actions'

interface Props {
  hasCredentialAccount: boolean
}

export function PasswordSection({ hasCredentialAccount }: Props) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!hasCredentialAccount) return null

  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    startTransition(async () => {
      const result = await changePasswordAction(current, next)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Password changed.')
        setCurrent('')
        setNext('')
        setConfirm('')
      }
    })
  }

  return (
    <section>
      <h2 className="text-sm font-semibold mb-4">Password</h2>
      <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            disabled={isPending}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            value={next}
            onChange={e => setNext(e.target.value)}
            disabled={isPending}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            disabled={isPending}
            autoComplete="new-password"
            aria-invalid={mismatch}
          />
          {mismatch && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
        </div>
        <Button type="submit" size="sm" disabled={isPending || !canSubmit}>
          {isPending ? 'Saving...' : 'Change password'}
        </Button>
      </form>
    </section>
  )
}
