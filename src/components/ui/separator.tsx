"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        // Branch on the prop with plain utilities (not high-specificity
        // data-* variants) so consumers can override width/height via cn().
        // my-auto centers a fixed-height vertical separator; it's a no-op
        // when the separator stretches to fill its parent.
        orientation === "horizontal"
          ? "h-px w-full"
          : "my-auto w-px self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
