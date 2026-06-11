'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, Trash2, AlertTriangle, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { scanCompany, removeWatch } from '@/modules/job-hunt/actions'
import { EditWatchSheet } from './edit-watch-sheet'
import type { CompanyWatch } from '@prisma/client'

const PROVIDER_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  unknown: 'Unknown',
}

export function CompanyWatchRow({ watch }: { watch: CompanyWatch }) {
  const [isScanning, startScan] = useTransition()
  const [isRemoving, startRemove] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()

  function handleScan() {
    startScan(async () => {
      const result = await scanCompany(watch.id)
      if (!result.ok) {
        const messages: Record<string, string> = {
          not_found: 'Watch not found',
          no_ats_detected: 'No ATS detected — try updating the careers URL',
          fetch_failed: 'Could not reach the job board. Try again later.',
        }
        toast.error(messages[result.error] ?? 'Scan failed')
        return
      }
      toast.success(
        result.newJobs > 0
          ? `Found ${result.newJobs} new role${result.newJobs === 1 ? '' : 's'}`
          : 'No new roles found',
      )
      router.refresh()
    })
  }

  function handleRemove() {
    startRemove(async () => {
      await removeWatch(watch.id)
      toast.success(`Stopped watching ${watch.name}`)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className="font-medium truncate">{watch.name}</p>
            {watch.searchLocations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {watch.searchLocations.map(loc => (
                  <Badge key={loc} variant="outline" className="text-xs px-1.5 py-0 font-normal">
                    {loc}
                  </Badge>
                ))}
                {watch.includeRemote && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 font-normal text-muted-foreground">
                    + remote
                  </Badge>
                )}
              </div>
            )}
            {watch.lastScannedAt ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last scanned {formatDate(watch.lastScannedAt)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">Never scanned</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {watch.status === 'discovery_failed' ? (
            <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
              <AlertTriangle className="size-3" />
              ATS unknown
            </Badge>
          ) : (
            <Badge variant="secondary">{PROVIDER_LABELS[watch.atsProvider] ?? watch.atsProvider}</Badge>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleScan}
            disabled={isScanning || watch.status === 'discovery_failed'}
          >
            {isScanning ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            <span className="ml-1.5">{isScanning ? 'Scanning…' : 'Scan'}</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditOpen(true)}
            className="text-muted-foreground"
            aria-label="Edit location filter"
          >
            <Pencil className="size-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemove}
            disabled={isRemoving}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <EditWatchSheet watch={watch} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
