import { brand } from "@/lib/brand"
import { cn } from "@/lib/utils"

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
} as const

export function Wordmark({
  size = "md",
  className,
}: {
  size?: keyof typeof sizeClasses
  className?: string
}) {
  return (
    <span className={cn("font-semibold lowercase tracking-tight", sizeClasses[size], className)}>
      {brand.name}
    </span>
  )
}
