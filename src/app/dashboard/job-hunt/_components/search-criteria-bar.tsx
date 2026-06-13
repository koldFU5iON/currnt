'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LocationTagsInput } from './location-tags-input'
import { saveJobHuntSearch } from '@/modules/job-hunt/board-sources/actions'
import type { JobHuntSearchCriteria, DatePosted } from '@/modules/job-hunt/board-sources/schema'

type Props = {
  initial: JobHuntSearchCriteria
}

const DATE_OPTIONS: { value: DatePosted; label: string }[] = [
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'last90', label: 'Last 90 days' },
  { value: 'any', label: 'Any time' },
]

export function SearchCriteriaBar({ initial }: Props) {
  const [roles, setRoles] = useState<string[]>(initial.roles)
  const [locations, setLocations] = useState<string[]>(initial.locations)
  const [datePosted, setDatePosted] = useState<DatePosted>(initial.datePosted)
  const [minSalary, setMinSalary] = useState<string>(
    initial.minSalary != null ? String(initial.minSalary) : '',
  )
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleApply() {
    startTransition(async () => {
      const salaryNum = minSalary.trim() ? Number(minSalary.replace(/[^0-9]/g, '')) : null
      await saveJobHuntSearch({
        roles,
        locations,
        datePosted,
        minSalary: salaryNum && !isNaN(salaryNum) ? salaryNum : null,
      })
      toast.success('Search criteria saved')
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border bg-card px-4 py-3 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1.2fr_0.8fr_0.8fr_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Roles</Label>
          <LocationTagsInput
            value={roles}
            onChange={setRoles}
            placeholder="+ add role…"
          />
          <p className="text-[10px] text-muted-foreground">Auto-seeded from profile · editable</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Locations</Label>
          <LocationTagsInput
            value={locations}
            onChange={setLocations}
            placeholder="+ add location…"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Date Posted</Label>
          <Select value={datePosted} onValueChange={(v) => setDatePosted(v as DatePosted)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Min. Salary</Label>
          <div className="relative">
            <Input
              value={minSalary}
              onChange={(e) => setMinSalary(e.target.value)}
              placeholder="Any"
              className="h-9 pr-5 text-sm"
            />
            {minSalary && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                +
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Where disclosed</p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleApply}
          disabled={isPending}
          className="h-9 self-start mt-6"
        >
          Apply
        </Button>
      </div>
    </div>
  )
}
