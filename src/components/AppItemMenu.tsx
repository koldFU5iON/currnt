import Link from "next/link"
import {
  Archive,
  FilePlus,
  Inspect,
  LucideIcon,
  Menu,
  Pencil,
  Trash
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type AppControlsProps = {
  id: string
}

export function AppControls({ id }: AppControlsProps) {
  return (
    <div className="flex items-center space-x-2 p-2 justify-between border rounded-md">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Menu size={12} />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Quick Actions</DropdownMenuLabel>
            <AppControlsItem
              Icon={Inspect}
              label="View"
              action={`/dashboard/job-applications/view/${id}`}
              shortcut="V"
            />
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">File Management</DropdownMenuLabel>
            <AppControlsItem
              Icon={FilePlus}
              label="Add File"
              disabled
              shortcut="⌘F"
            />
            <AppControlsItem
              Icon={Pencil}
              label="Edit"
              disabled
              shortcut="⌘E"
            />
            <AppControlsItem
              Icon={Archive}
              label="Archive"
              disabled
            />
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <AppControlsItem
              Icon={Trash}
              label="Delete Job"
              color="red"
              disabled
            />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

type AppControlsItemProps = {
  Icon: LucideIcon
  label: string
  color?: string
  action?: string
  disabled?: boolean
  shortcut?: string
}

function AppControlsItem({ Icon, color, label, action, disabled, shortcut }: AppControlsItemProps) {
  const content = (
    <>
      {Icon && <Icon color={color} className="size-4" />}
      <span className="flex-1">{label}</span>
      {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
    </>
  )

  if (action && !disabled) {
    return (
      <Link href={action}>
        <DropdownMenuItem className="hover:amber-500/50 cursor-pointer">
          {content}
        </DropdownMenuItem>
      </Link>
    )
  }

  return (
    <DropdownMenuItem disabled={disabled} className={!disabled ? "hover:amber-500/50 cursor-pointer" : ""}>
      {content}
    </DropdownMenuItem>
  )
}

