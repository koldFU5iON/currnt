"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  // Render both icons and swap them with CSS so server and client markup
  // match (no hydration mismatch, no mounted guard). The click handler only
  // runs after hydration, where resolvedTheme is known.
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative size-9 [&_svg]:size-5"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
