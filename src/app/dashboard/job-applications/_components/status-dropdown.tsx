'use client'

import { useTransition } from "react"
import {
  ClosedStatuses,
  OpenStatuses,
  type ApplicationStatusType,
} from "@/app/types/job-application"
import { updateJobStatus } from "@/modules/jobs/mutations"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

type StatusDropdownProps = {
  jobId: string
  status: ApplicationStatusType
}

export function StatusDropdown({ jobId, status }: StatusDropdownProps) {
  const [isPending, startTransition] = useTransition()

  const handleSelect = (next: ApplicationStatusType) => {
    if (next === status) return
    startTransition(async () => {
      await updateJobStatus(jobId, next)
    })
  }

  const renderItems = (states: readonly ApplicationStatusType[]) =>
    states.map((state) => (
      <DropdownMenuItem
        key={state}
        onClick={() => handleSelect(state)}
        className="capitalize"
      >
        {state}
      </DropdownMenuItem>
    ))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className={cn(buttonVariants({ variant: "outline" }), "capitalize")}
      >
        {isPending ? <Loader2 className="size-3 animate-spin" /> : null}
        {status}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>{renderItems(OpenStatuses)}</DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>{renderItems(ClosedStatuses)}</DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
