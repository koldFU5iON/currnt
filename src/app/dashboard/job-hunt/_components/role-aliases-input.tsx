'use client'

import { useState, useTransition } from 'react'
import { LocationTagsInput } from './location-tags-input'
import { saveAdditionalRoles } from '@/modules/job-hunt/actions'

export function RoleAliasesInput({ initialRoles }: { initialRoles: string[] }) {
  const [roles, setRoles] = useState(initialRoles)
  const [isPending, startTransition] = useTransition()

  function handleChange(newRoles: string[]) {
    setRoles(newRoles)
    startTransition(async () => {
      await saveAdditionalRoles(newRoles)
    })
  }

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Also search for</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Role aliases that expand your scan beyond your primary target role.
        </p>
      </div>
      <LocationTagsInput
        value={roles}
        onChange={handleChange}
        placeholder="e.g. Operations, MarOps, Public Relations — press Enter to add"
      />
      {isPending && <p className="text-xs text-muted-foreground mt-1.5">Saving…</p>}
    </section>
  )
}
