'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocationTagsInput } from './location-tags-input'
import { saveScanParameters } from '@/modules/job-hunt/actions'

type Props = {
  targetRole: string
  currentRole: string
  additionalRoles: string[]
}

export function ScanSettingsDialog({ targetRole, currentRole, additionalRoles }: Props) {
  const [open, setOpen] = useState(false)
  const [roles, setRoles] = useState(additionalRoles)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave(formData: FormData) {
    startTransition(async () => {
      await saveScanParameters({
        targetRole: (formData.get('targetRole') as string) ?? '',
        currentRole: (formData.get('currentRole') as string) ?? '',
        additionalRoles: roles,
      })
      toast.success('Scan parameters saved')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="w-full h-8 text-xs gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Settings2 className="size-3.5" />
        Scan parameters
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan parameters</DialogTitle>
        </DialogHeader>
        <form action={handleSave} className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="targetRole">Target role</Label>
            <Input
              id="targetRole"
              name="targetRole"
              defaultValue={targetRole}
              placeholder="e.g. Director-level ops roles"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentRole">Current role</Label>
            <Input
              id="currentRole"
              name="currentRole"
              defaultValue={currentRole}
              placeholder="e.g. Communications operations"
            />
          </div>
          <div className="space-y-2">
            <Label>Also search for</Label>
            <p className="text-xs text-muted-foreground">
              Role aliases that expand your scan keywords beyond the target role.
            </p>
            <LocationTagsInput
              value={roles}
              onChange={setRoles}
              placeholder="e.g. Operations, MarOps — press Enter to add"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save parameters'}
          </Button>
        </form>
      </DialogContent>
      </Dialog>
    </>
  )
}
