import { cn } from "@/lib/utils"
import { brand } from "@/lib/brand"
import { CurrntIcon } from "./icon"

type Variant = "line" | "stacked" | "icon" | "copy"
type Size = "sm" | "md" | "lg"

const sizes: Record<Size, { icon: number; text: string; gap: string }> = {
  sm: { icon: 18, text: "text-sm  font-semibold", gap: "gap-2" },
  md: { icon: 24, text: "text-base font-semibold", gap: "gap-2.5" },
  lg: { icon: 32, text: "text-xl  font-semibold", gap: "gap-3" },
}

export function Logo({
  variant = "line",
  size = "md",
  className,
}: {
  variant?: Variant
  size?: Size
  className?: string
}) {
  const { icon, text, gap } = sizes[size]
  const wordmark = <span className={cn("lowercase tracking-tight", text)}>{brand.name}</span>

  if (variant === "icon") return <CurrntIcon size={icon} className={className} />

  if (variant === "copy") return <span className={cn("lowercase tracking-tight", text, className)}>{brand.name}</span>

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <CurrntIcon size={Math.round(icon * 1.5)} />
        {wordmark}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center", gap, className)}>
      <CurrntIcon size={icon} />
      {wordmark}
    </div>
  )
}
