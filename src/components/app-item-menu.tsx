import Link from "next/link"
import {
  Archive,
  FilePlus,
  Inspect,
  LucideIcon,
  MoreHorizontal,
  Pencil,
  Trash
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type AppControlsProps = {
  id: string
  onEdit?: () => void
  onArchive?: () => void
}

export function AppControls({ id, onEdit, onArchive }: AppControlsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Job actions"
        className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal size={16} />
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
            onSelect={onEdit}
            disabled={!onEdit}
            shortcut="⌘E"
          />
          <AppControlsItem
            Icon={Archive}
            label="Archive"
            onSelect={onArchive}
            disabled={!onArchive}
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
  )
}

type AppControlsItemProps = {
  Icon: LucideIcon
  label: string
  color?: string
  action?: string
  onSelect?: () => void
  disabled?: boolean
  shortcut?: string
}

function AppControlsItem({ Icon, color, label, action, onSelect, disabled, shortcut }: AppControlsItemProps) {
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
        <DropdownMenuItem className="cursor-pointer">
          {content}
        </DropdownMenuItem>
      </Link>
    )
  }

  // base-ui Menu.Item dispatches keyboard activation as onClick (unlike Radix's onSelect)
  return (
    <DropdownMenuItem
      disabled={disabled}
      onClick={onSelect}
      className={!disabled ? "cursor-pointer" : ""}
    >
      {content}
    </DropdownMenuItem>
  )
}
