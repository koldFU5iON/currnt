import { Button } from "@/components/ui/button"
import {
  Archive,
  FilePlus,
  LucideIcon,
  Menu,
  Pencil,
  Trash
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function AppControls() {
  return (
    <div className="flex items-center space-x-2 p-2 justify-between border rounded-md">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Menu size={12} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <AppControlsItem Icon={FilePlus} label="Add File" />
            <AppControlsItem Icon={Archive} label="Archive" />
            <AppControlsItem Icon={Pencil} label="Edit" />
            <DropdownMenuSeparator />
            <AppControlsItem Icon={Trash} color="red" label="Delete Job" />
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
}

function AppControlsItem({ Icon, color, label }: AppControlsItemProps) {
  return (
    <DropdownMenuItem className="hover:amber-500/50">
      {Icon && <Icon color={color} className="size-4" />} {label}
    </DropdownMenuItem >
  )
}

