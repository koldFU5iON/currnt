'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { scanAll } from '@/modules/job-hunt/actions'

export function SyncAllButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSync() {
    startTransition(async () => {
      const result = await scanAll()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const { scanned, newJobs, failed } = result
      const failedSuffix = failed > 0 ? ` · ${failed} failed` : ''
      if (newJobs > 0) {
        toast.success(
          `Scanned ${scanned} source${scanned === 1 ? '' : 's'} · ${newJobs} new role${newJobs === 1 ? '' : 's'} found${failedSuffix}`
        )
      } else if (failed > 0 && failed === scanned) {
        toast.error('All scans failed — check configuration')
      } else {
        toast.success(`Scanned ${scanned} source${scanned === 1 ? '' : 's'} · no new roles${failedSuffix}`)
      }
      router.refresh()
    })
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleSync}
      disabled={isPending}
      className="h-7 px-2 text-xs"
    >
      {isPending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
      <span className="ml-1">{isPending ? 'Syncing…' : 'Sync All'}</span>
    </Button>
  )
}
